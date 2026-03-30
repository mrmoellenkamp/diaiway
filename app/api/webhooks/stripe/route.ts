import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { onPaymentReceived, creditWalletTopup } from "@/lib/wallet-service"
import { notifyTakumiAfterPayment } from "@/lib/notification-service"
import { validateInvoiceDataForPayment } from "@/lib/invoice-requirements"
import { createGuestShugyoAccount } from "@/lib/guest-onboarding"
import type Stripe from "stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Stripe Webhook endpoint.
 * Handles checkout.session.completed events to confirm payments.
 */
export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret?.trim()) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured – refusing to process")
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("[Stripe Webhook] Signature verification failed:", errorMessage)
    return NextResponse.json(
      { error: "Webhook-Signatur ungültig." },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case "checkout.session.async_payment_succeeded": {
        // Asynchrone Zahlungsmethoden (SEPA, iDEAL etc.): Wallet erst hier gutschreiben
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case "payment_intent.amount_capturable_updated": {
        // Fallback bei manual capture: checkout.session.completed kann payment_status=unpaid haben;
        // dieses Event feuert, wenn die Zahlung autorisiert ist
        const pi = event.data.object as Stripe.PaymentIntent
        await handleAmountCapturableUpdated(pi)
        break
      }

      case "payment_intent.succeeded":
        // Hauptfluss über checkout.session.completed; hier keine Aktion nötig
        break

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(paymentIntent)
        break
      }

      case "account.updated": {
        // Stripe Connect: Takumi-Konto Status aktualisieren
        const account = event.data.object as Stripe.Account
        await handleConnectAccountUpdated(account)
        break
      }

      default:
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("[Stripe Webhook] Error processing event:", errorMessage)
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen." }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentType = session.metadata?.type

  // Wallet-Aufladung (Instant-Connect)
  if (paymentType === "wallet_topup") {
    // Bei async-Zahlungsmethoden (SEPA etc.) ist payment_status hier "unpaid" –
    // Gutschrift erfolgt über checkout.session.async_payment_succeeded
    if (session.payment_status !== "paid") return

    const userId = session.metadata?.userId
    if (!userId) {
      console.error("[Stripe Webhook] wallet_topup: missing userId")
      return
    }
    const amountTotal = session.amount_total ?? 0
    try {
      await creditWalletTopup(userId, amountTotal, session.id)
      console.log(`[Stripe Webhook] Wallet topup: ${amountTotal / 100} € für User ${userId}`)
    } catch (err) {
      console.error("[Stripe Webhook] creditWalletTopup failed:", err)
    }
    return
  }

  const bookingId = session.metadata?.bookingId
  if (!bookingId) {
    console.error("[Stripe Webhook] No bookingId in session metadata")
    return
  }

  // ── Guest call payment ─────────────────────────────────────────────────────
  if (paymentType === "guest_call_payment") {
    await handleGuestCallPayment(session, bookingId)
    return
  }

  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      userId: true,
      user: { select: { invoiceData: true } },
    },
  })
  if (existing?.paymentStatus === "paid") return // Idempotenz

  if (
    paymentType === "booking_payment" &&
    existing?.userId &&
    !validateInvoiceDataForPayment(existing.user?.invoiceData ?? null).ok
  ) {
    console.error(
      "[Stripe Webhook] AUDIT: booking_payment completed at Stripe but Shugyo invoice profile incomplete bookingId=%s userId=%s (Zahlung wird trotzdem gebucht — manuell prüfen)",
      bookingId,
      existing.userId
    )
  }

  // Bei manual capture: payment_status = "unpaid" (autorisiert, nicht eingezogen) – trotzdem erfüllen
  const amountTotal = session.amount_total ?? 0

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: "paid",
      stripePaymentIntentId: session.payment_intent as string,
      paidAt: new Date(),
      paidAmount: amountTotal,
    },
  })

  // Wallet: Betrag in pendingBalance des Takumi parken
  try {
    await onPaymentReceived(bookingId, amountTotal)
  } catch (walletErr) {
    console.error("[Stripe Webhook] Wallet onPaymentReceived failed:", walletErr)
  }

  if (paymentType === "booking_payment") {
    try {
      await notifyTakumiAfterPayment(bookingId)
    } catch (notifyErr) {
      console.error("[Stripe Webhook] Booking notification failed:", notifyErr)
    }
  }
}

/**
 * Handles a completed guest call payment:
 * 1. Marks booking as paid
 * 2. If guest set a password: creates a Shugyo account and links it to the booking
 * 3. Notifies the Takumi
 */
async function handleGuestCallPayment(session: Stripe.Checkout.Session, bookingId: string) {
  const existing = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true, guestEmail: true, note: true, isGuestCall: true },
  })
  if (!existing || !existing.isGuestCall) {
    console.error("[Stripe Webhook] guest_call_payment: booking not found or not a guest call", bookingId)
    return
  }
  if (existing.paymentStatus === "paid") return // Idempotenz

  const amountTotal = session.amount_total ?? 0
  const now = new Date()

  // Parse the note field where we stored invoice + password data at checkout
  let invoiceData: unknown = null
  let guestPassword: string | null = null
  try {
    if (existing.note) {
      const parsed = JSON.parse(existing.note) as Record<string, unknown>
      invoiceData = parsed.invoiceData ?? null
      guestPassword = typeof parsed.guestPassword === "string" ? parsed.guestPassword : null
    }
  } catch {
    console.warn("[Stripe Webhook] guest_call_payment: could not parse note field for bookingId", bookingId)
  }

  // Mark booking as paid
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: "paid",
      stripePaymentIntentId: session.payment_intent as string,
      paidAt: now,
      paidAmount: amountTotal,
      // Clear the note field (it held temporary checkout data)
      note: "",
    },
  })

  // Instant Shugyo onboarding: create account if password was provided
  if (guestPassword && existing.guestEmail) {
    try {
      const result = await createGuestShugyoAccount({
        guestEmail: existing.guestEmail,
        password: guestPassword,
        invoiceData,
        consentTimestamp: now,
      })

      if (result) {
        // Link the booking to the new (or existing) user account
        await prisma.booking.update({
          where: { id: bookingId },
          data: { userId: result.userId },
        })
        console.log(
          `[Stripe Webhook] Guest onboarding: ${result.isNew ? "created" : "linked existing"} account ${result.userId} for booking ${bookingId}`
        )
      }
    } catch (err) {
      console.error("[Stripe Webhook] Guest onboarding failed (non-fatal):", err)
    }
  }

  // Notify Takumi that payment was received
  try {
    await notifyTakumiAfterPayment(bookingId)
  } catch (notifyErr) {
    console.error("[Stripe Webhook] Guest call notification failed:", notifyErr)
  }
}

/** Fallback für manual capture: Zahlung autorisiert, noch nicht eingezogen */
async function handleAmountCapturableUpdated(pi: Stripe.PaymentIntent) {
  if (pi.status !== "requires_capture") return

  const bookingId = pi.metadata?.bookingId
  if (!bookingId) return

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      userId: true,
      user: { select: { invoiceData: true } },
    },
  })
  if (!booking || booking.paymentStatus === "paid") return

  if (
    pi.metadata?.type === "booking_payment" &&
    booking.userId &&
    !validateInvoiceDataForPayment(booking.user?.invoiceData ?? null).ok
  ) {
    console.error(
      "[Stripe Webhook] AUDIT: payment_intent capturable but invoice incomplete bookingId=%s userId=%s",
      bookingId,
      booking.userId
    )
  }

  const amountTotal = pi.amount ?? 0
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentStatus: "paid",
      stripePaymentIntentId: pi.id,
      paidAt: new Date(),
      paidAmount: amountTotal,
    },
  })

  try {
    await onPaymentReceived(bookingId, amountTotal)
  } catch (walletErr) {
    console.error("[Stripe Webhook] Wallet onPaymentReceived failed:", walletErr)
  }

  if (pi.metadata?.type === "booking_payment") {
    try {
      await notifyTakumiAfterPayment(bookingId)
    } catch (notifyErr) {
      console.error("[Stripe Webhook] Booking notification failed:", notifyErr)
    }
  }
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  const bookingId = pi.metadata?.bookingId
  if (!bookingId) {
    return
  }

  await prisma.booking.updateMany({
    where: { id: bookingId },
    data: { paymentStatus: "failed" },
  })
}

/** Stripe Connect: Konto-Status synchronisieren wenn Takumi Onboarding abschließt */
async function handleConnectAccountUpdated(account: Stripe.Account) {
  const expertId = account.metadata?.expertId
  if (!expertId) return

  const isActive =
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted

  const status = isActive
    ? "active"
    : account.details_submitted
      ? "restricted"
      : "pending"

  try {
    const expert = await prisma.expert.findUnique({
      where: { id: expertId },
      select: { stripeConnectOnboardedAt: true },
    })

    await prisma.expert.update({
      where: { id: expertId },
      data: {
        stripeConnectStatus: status,
        ...(isActive && !expert?.stripeConnectOnboardedAt
          ? { stripeConnectOnboardedAt: new Date() }
          : {}),
      },
    })

    console.log(`[Stripe Connect] Account ${account.id} für Expert ${expertId}: ${status}`)
  } catch (err) {
    console.error("[Stripe Connect] handleConnectAccountUpdated:", err)
  }
}

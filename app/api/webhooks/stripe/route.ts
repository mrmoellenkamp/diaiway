import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { onPaymentReceived } from "@/lib/wallet-service"
import { notifyTakumiAfterPayment } from "@/lib/notify-takumi"
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
  let event: Stripe.Event

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      event = JSON.parse(body) as Stripe.Event
      console.warn("[Stripe Webhook] No STRIPE_WEBHOOK_SECRET configured, skipping signature verification")
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("[Stripe Webhook] Signature verification failed:", errorMessage)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${errorMessage}` },
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

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log("[Stripe Webhook] Payment intent succeeded:", paymentIntent.id)
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(paymentIntent)
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("[Stripe Webhook] Error processing event:", errorMessage)
    return NextResponse.json({ error: `Webhook handler failed: ${errorMessage}` }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId
  if (!bookingId) {
    console.error("[Stripe Webhook] No bookingId in session metadata")
    return
  }

  console.log("[Stripe Webhook] Processing checkout.session.completed for booking:", bookingId)

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

  // Bei Vorauszahlung (booking_payment): E-Mail + Notification an Takumi senden
  const paymentType = session.metadata?.type
  if (paymentType === "booking_payment") {
    try {
      await notifyTakumiAfterPayment(bookingId)
    } catch (notifyErr) {
      console.error("[Stripe Webhook] Booking notification failed:", notifyErr)
    }
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId
  if (!bookingId) {
    console.log("[Stripe Webhook] No bookingId in payment intent metadata")
    return
  }

  console.log("[Stripe Webhook] Payment failed for booking:", bookingId)
  await prisma.booking.updateMany({
    where: { id: bookingId },
    data: { paymentStatus: "failed" },
  })
}

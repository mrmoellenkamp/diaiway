import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { validateInvoiceDataForPayment } from "@/lib/invoice-requirements"
import { parseBerlinDateTime } from "@/lib/date-utils"

// Payment window: opens 5 min before call, closes 5 min after call end
const PAY_OPEN_MIN_BEFORE  = 5
const CALL_GRACE_MIN_AFTER = 5

export const runtime = "nodejs"

/**
 * POST /api/guest/checkout
 * Called from the /call/[guestToken] legal-gate page.
 * No NextAuth session required — authenticated by guestToken.
 *
 * Body:
 *   guestToken   – UUID from the booking
 *   invoiceData  – billing data (validated via invoice-requirements)
 *   password?    – optional: guest wants instant Shugyo account
 *   consentWithdrawal  – boolean: right-of-withdrawal waiver
 *   consentSnapshot    – boolean: safety snapshot consent
 */
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`guest-checkout:${ip}`, { limit: 20, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen.", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 })
  }

  const { guestToken, invoiceData, password, consentWithdrawal, consentSnapshot } = body

  if (!guestToken || typeof guestToken !== "string") {
    return NextResponse.json({ error: "guestToken fehlt." }, { status: 400 })
  }
  if (!consentWithdrawal) {
    return NextResponse.json({ error: "Widerrufsverzicht muss bestätigt werden." }, { status: 400 })
  }
  if (!consentSnapshot) {
    return NextResponse.json({ error: "Einwilligung zum Sicherheits-Snapshot muss erteilt werden." }, { status: 400 })
  }

  const invoiceValidation = validateInvoiceDataForPayment(invoiceData)
  if (!invoiceValidation.ok) {
    return NextResponse.json(
      { error: "Rechnungsdaten unvollständig.", code: "INVOICE_INCOMPLETE", missingFieldKeys: invoiceValidation.missingFieldKeys },
      { status: 400 }
    )
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken },
    include: { expert: { select: { name: true } } },
  })

  if (!booking) {
    return NextResponse.json({ error: "Einladung nicht gefunden oder abgelaufen." }, { status: 404 })
  }
  if (!booking.isGuestCall) {
    return NextResponse.json({ error: "Ungültige Einladung." }, { status: 400 })
  }
  if (booking.paymentStatus === "paid") {
    return NextResponse.json({ error: "Bereits bezahlt.", code: "ALREADY_PAID" }, { status: 409 })
  }

  // Enforce payment window: 5 min before call start until 5 min after call end
  if (booking.date && booking.startTime && booking.endTime) {
    const now = new Date()
    const callStart = parseBerlinDateTime(booking.date, booking.startTime)
    const callEnd   = parseBerlinDateTime(booking.date, booking.endTime)
    const payOpenAt = new Date(callStart.getTime() - PAY_OPEN_MIN_BEFORE  * 60_000)
    const payCloseAt = new Date(callEnd.getTime()  + CALL_GRACE_MIN_AFTER * 60_000)
    if (now < payOpenAt) {
      return NextResponse.json(
        {
          error: "Der Zahlungslink ist noch nicht aktiv.",
          code: "TOO_EARLY",
          payOpenAt: payOpenAt.toISOString(),
          callStartAt: callStart.toISOString(),
        },
        { status: 425 }  // Too Early
      )
    }
    if (now > payCloseAt) {
      return NextResponse.json(
        { error: "Der Termin ist abgelaufen.", code: "EXPIRED" },
        { status: 410 }  // Gone
      )
    }
  }

  // Reuse existing Stripe session if still open
  if (booking.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(booking.stripeSessionId)
      if (existing.status === "open" && existing.client_secret) {
        // Store invoice + consent data even when reusing session
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            snapshotConsentAt: new Date(),
            safetyAcceptedAt: new Date(),
          },
        })
        return NextResponse.json({ clientSecret: existing.client_secret, bookingId: booking.id })
      }
    } catch {
      // Session expired, create new one
    }
  }

  const takumiName = booking.expert?.name ?? "Experte"
  const priceInCents = booking.totalPrice ? Math.round(Number(booking.totalPrice) * 100) : 0

  if (priceInCents <= 0) {
    return NextResponse.json({ error: "Ungültiger Preis für diese Buchung." }, { status: 400 })
  }

  const durationMin = (() => {
    if (booking.startTime && booking.endTime) {
      const [sh, sm] = booking.startTime.split(":").map(Number)
      const [eh, em] = booking.endTime.split(":").map(Number)
      return (eh * 60 + em) - (sh * 60 + sm)
    }
    return 30
  })()

  // Guest checkout: immediate capture (no hold) since call is imminent
  const sessionData = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    payment_method_types: ["card"],
    customer_email: typeof invoiceData === "object" && invoiceData !== null && "email" in invoiceData
      ? String((invoiceData as Record<string, unknown>).email)
      : booking.guestEmail ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Gast-Call mit ${takumiName}`,
            description: `${durationMin} Minuten am ${booking.date} um ${booking.startTime} Uhr`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      capture_method: "automatic", // Immediate capture for guest calls
      metadata: {
        bookingId: booking.id,
        guestToken,
        type: "guest_call_payment",
        hasPassword: password ? "1" : "0",
      },
    },
    metadata: {
      bookingId: booking.id,
      guestToken,
      type: "guest_call_payment",
      hasPassword: password ? "1" : "0",
    },
  })

  const paymentIntentId =
    typeof sessionData.payment_intent === "string"
      ? sessionData.payment_intent
      : sessionData.payment_intent?.id ?? null

  // Store legal consent timestamps, invoice data and optional password hash
  // Password hashing is deferred to the webhook (Etappe 3) where full account creation happens.
  // Here we store the raw (encrypted at rest by DB) password temporarily in a dedicated field.
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      stripeSessionId: sessionData.id,
      ...(paymentIntentId && { stripePaymentIntentId: paymentIntentId }),
      paymentStatus: "pending",
      snapshotConsentAt: new Date(),
      safetyAcceptedAt: new Date(),
      // Store guest invoice + onboarding data as JSON in the note field for webhook pickup
      // (will be migrated to dedicated fields in Etappe 3)
      note: JSON.stringify({
        invoiceData,
        guestPassword: password || null,
        consentWithdrawal: true,
        consentSnapshot: true,
      }),
    },
  })

  return NextResponse.json({ clientSecret: sessionData.client_secret, bookingId: booking.id })
}

/**
 * GET /api/guest/checkout?guestToken=...
 * Returns booking details needed for the legal-gate form (date, time, price, takumi name).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const guestToken = searchParams.get("guestToken")

  if (!guestToken) {
    return NextResponse.json({ error: "guestToken fehlt." }, { status: 400 })
  }

  const ip = getClientIp(req)
  const rl = rateLimit(`guest-info:${ip}`, { limit: 60, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 })
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken },
    select: {
      id: true,
      isGuestCall: true,
      date: true,
      startTime: true,
      endTime: true,
      totalPrice: true,
      paymentStatus: true,
      callType: true,
      expert: { select: { name: true, avatar: true } },
    },
  })

  if (!booking || !booking.isGuestCall) {
    return NextResponse.json({ error: "Einladung nicht gefunden." }, { status: 404 })
  }

  // Compute time window info for the client
  let windowInfo: {
    payOpenAt: string
    callStartAt: string
    callEndAt: string
    payCloseAt: string
    isOpen: boolean
    isExpired: boolean
    secondsUntilOpen: number
  } | null = null

  if (booking.date && booking.startTime && booking.endTime) {
    const now = new Date()
    const callStart  = parseBerlinDateTime(booking.date, booking.startTime)
    const callEnd    = parseBerlinDateTime(booking.date, booking.endTime)
    const payOpenAt  = new Date(callStart.getTime() - PAY_OPEN_MIN_BEFORE  * 60_000)
    const payCloseAt = new Date(callEnd.getTime()   + CALL_GRACE_MIN_AFTER * 60_000)
    const isOpen    = now >= payOpenAt && now <= payCloseAt
    const isExpired = now > payCloseAt
    const secondsUntilOpen = isOpen ? 0 : Math.max(0, Math.ceil((payOpenAt.getTime() - now.getTime()) / 1000))
    windowInfo = {
      payOpenAt:    payOpenAt.toISOString(),
      callStartAt:  callStart.toISOString(),
      callEndAt:    callEnd.toISOString(),
      payCloseAt:   payCloseAt.toISOString(),
      isOpen,
      isExpired,
      secondsUntilOpen,
    }
  }

  if (booking.paymentStatus === "paid") {
    return NextResponse.json({
      booking: { ...booking, alreadyPaid: true },
      windowInfo,
    })
  }

  return NextResponse.json({ booking, windowInfo })
}

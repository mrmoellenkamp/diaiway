import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { createHmac } from "crypto"

export const runtime = "nodejs"

function validateToken(token: string, bookingId: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split(":")
    if (parts.length !== 4) return null

    const [tokenBookingId, userId, expiresAtStr, sig] = parts
    if (tokenBookingId !== bookingId) return null
    if (Date.now() > parseInt(expiresAtStr, 10)) return null

    const payload = `${tokenBookingId}:${userId}:${expiresAtStr}`
    const secret = process.env.NEXTAUTH_SECRET!
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex")
    if (sig !== expectedSig) return null

    return { userId }
  } catch {
    return null
  }
}

/**
 * POST /api/pay/[bookingId]?token=...
 * Erstellt eine Stripe Checkout Session für die /pay Seite.
 * Authentifizierung via signiertem Pay-Token (kein NextAuth nötig).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params
  const url = new URL(req.url)
  const token = url.searchParams.get("token") ?? ""

  const auth = validateToken(token, bookingId)
  if (!auth) {
    return NextResponse.json({ error: "Ungültiger oder abgelaufener Token." }, { status: 401 })
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }
  if (booking.userId !== auth.userId) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }
  if (booking.paymentStatus === "paid") {
    return NextResponse.json({ error: "Bereits bezahlt." }, { status: 409 })
  }

  // Falls bereits eine aktive Stripe Session existiert, wiederverwenden
  if (booking.stripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(booking.stripeSessionId)
      if (existing.status === "open" && existing.client_secret) {
        return NextResponse.json({ clientSecret: existing.client_secret })
      }
    } catch {
      // Session abgelaufen oder ungültig, neu erstellen
    }
  }

  const { expertId, totalPrice } = booking
  const priceInCents = totalPrice ? Math.round(Number(totalPrice) * 100) : 0

  // Experten-Name holen
  const expert = await prisma.expert.findUnique({
    where: { id: expertId },
    select: { name: true },
  })
  const takumiName = expert?.name ?? "Experte"

  const durationMin = (() => {
    if (booking.startTime && booking.endTime) {
      const [sh, sm] = booking.startTime.split(":").map(Number)
      const [eh, em] = booking.endTime.split(":").map(Number)
      return (eh * 60 + em) - (sh * 60 + sm)
    }
    return 30
  })()

  const sessionData = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Buchung mit ${takumiName}`,
            description: `${durationMin} Minuten Beratung am ${booking.date} um ${booking.startTime} Uhr`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      capture_method: "manual",
      metadata: {
        bookingId,
        shugyoId: auth.userId,
        type: "booking_payment",
      },
    },
    metadata: { bookingId, shugyoId: auth.userId, type: "booking_payment" },
  })

  const paymentIntentId =
    typeof sessionData.payment_intent === "string"
      ? sessionData.payment_intent
      : sessionData.payment_intent?.id ?? null

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      stripeSessionId: sessionData.id,
      ...(paymentIntentId && { stripePaymentIntentId: paymentIntentId }),
      paymentStatus: "pending",
    },
  })

  return NextResponse.json({ clientSecret: sessionData.client_secret })
}

/**
 * GET /api/pay/[bookingId]/status?token=...
 * Prüft den Zahlungsstatus ohne NextAuth-Session.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params
  const url = new URL(req.url)
  const token = url.searchParams.get("token") ?? ""

  const auth = validateToken(token, bookingId)
  if (!auth) {
    return NextResponse.json({ error: "Ungültiger Token." }, { status: 401 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true, stripeSessionId: true },
  })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }

  if (booking.paymentStatus === "paid") {
    return NextResponse.json({ status: "paid" })
  }

  if (booking.paymentStatus === "pending" && booking.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId)
      const isPaidOrAuthorized =
        session.status === "complete" &&
        (session.payment_status === "paid" || session.payment_status === "unpaid")
      if (isPaidOrAuthorized) {
        // In DB als paid markieren
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: "paid",
            paidAt: new Date(),
            paidAmount: (session.amount_total ?? 0) / 100,
          },
        })
        return NextResponse.json({ status: "paid" })
      }
    } catch {
      // Stripe nicht erreichbar, DB-Status gilt
    }
  }

  return NextResponse.json({ status: booking.paymentStatus ?? "pending" })
}

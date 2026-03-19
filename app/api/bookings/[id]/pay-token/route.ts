import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createHmac } from "crypto"
import { validateInvoiceDataForPayment } from "@/lib/invoice-requirements"

export const runtime = "nodejs"

/**
 * POST /api/bookings/[id]/pay-token
 * Erstellt einen kurzlebigen, signierten Token für die /pay/[id] Seite.
 * Der Token enthält bookingId + userId + Ablaufzeit (15 min), HMAC-signiert.
 * Kein Login in der /pay-Seite nötig — Token beweist die Berechtigung.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id: bookingId } = await params

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }
  if (booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }
  if (booking.paymentStatus === "paid") {
    return NextResponse.json({ error: "Buchung bereits bezahlt." }, { status: 409 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { invoiceData: true },
  })
  const invoiceValidation = validateInvoiceDataForPayment(user?.invoiceData)
  if (!invoiceValidation.ok) {
    return NextResponse.json(
      {
        error: invoiceValidation.message,
        code: "INVOICE_DATA_INCOMPLETE",
        redirectTo: "/profile/invoice-data?required=1",
      },
      { status: 409 }
    )
  }

  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 Minuten
  const payload = `${bookingId}:${session.user.id}:${expiresAt}`
  const secret = process.env.NEXTAUTH_SECRET!
  const sig = createHmac("sha256", secret).update(payload).digest("hex")
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url")

  return NextResponse.json({ token })
}

/**
 * GET /api/bookings/[id]/pay-token?token=...
 * Validiert einen Pay-Token. Gibt bookingId + userId zurück wenn gültig.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 })
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split(":")
    if (parts.length !== 4) throw new Error("Invalid format")

    const [tokenBookingId, userId, expiresAtStr, sig] = parts
    const expiresAt = parseInt(expiresAtStr, 10)

    if (tokenBookingId !== bookingId) {
      return NextResponse.json({ error: "Token passt nicht zur Buchung." }, { status: 403 })
    }
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: "Token abgelaufen." }, { status: 401 })
    }

    const payload = `${tokenBookingId}:${userId}:${expiresAtStr}`
    const secret = process.env.NEXTAUTH_SECRET!
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex")
    if (sig !== expectedSig) {
      return NextResponse.json({ error: "Ungültige Signatur." }, { status: 403 })
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      bookingId,
      userId,
      expertId: booking.expertId,
      priceInCents: booking.totalPrice ? Math.round(Number(booking.totalPrice) * 100) : 0,
    })
  } catch {
    return NextResponse.json({ error: "Ungültiger Token." }, { status: 400 })
  }
}

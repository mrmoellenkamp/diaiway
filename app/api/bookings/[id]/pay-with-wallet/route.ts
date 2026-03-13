import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { payBookingWithWallet } from "@/lib/wallet-service"
import { notifyTakumiAfterPayment } from "@/lib/notification-service"
import { markVerified } from "@/lib/verification-service"

export const runtime = "nodejs"

/**
 * POST /api/bookings/[id]/pay-with-wallet
 * Shugyo bezahlt eine Buchung mit Wallet-Guthaben.
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

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }
  if (booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }
  if (booking.paymentStatus === "paid") {
    return NextResponse.json({ ok: true, message: "Bereits bezahlt." })
  }

  const result = await payBookingWithWallet(bookingId)
  if (!result.ok) {
    const msg =
      result.error === "INSUFFICIENT_FUNDS"
        ? "Nicht genügend Guthaben im Wallet."
        : result.error || "Zahlung fehlgeschlagen."
    return NextResponse.json(
      { error: msg, code: result.error === "INSUFFICIENT_FUNDS" ? "INSUFFICIENT_FUNDS" : undefined },
      { status: result.error === "INSUFFICIENT_FUNDS" ? 402 : 400 }
    )
  }

  await markVerified(session.user.id, "STRIPE_PAYMENT").catch(() => {})

  try {
    await notifyTakumiAfterPayment(bookingId)
  } catch (notifyErr) {
    console.error("[pay-with-wallet] Notification failed:", notifyErr)
  }

  return NextResponse.json({ ok: true, message: "Bezahlung erfolgreich." })
}

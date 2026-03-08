/**
 * POST: Takumi nach Zahlung benachrichtigen (idempotent).
 * Client ruft dies nach erfolgreicher Zahlung auf, falls Webhook/verifySessionPayment
 * die Benachrichtigung verpasst haben.
 */
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notifyTakumiAfterPayment } from "@/lib/notify-takumi"

export const runtime = "nodejs"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { userId: true, paymentStatus: true },
  })
  if (!booking || booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }
  if (booking.paymentStatus !== "paid") {
    return NextResponse.json({ error: "Buchung noch nicht bezahlt." }, { status: 400 })
  }

  const result = await notifyTakumiAfterPayment(bookingId)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Benachrichtigung fehlgeschlagen" },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    emailSent: result.emailSent,
    notificationCreated: result.notificationCreated,
  })
}

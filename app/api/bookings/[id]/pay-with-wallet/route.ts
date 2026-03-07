import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { payBookingWithWallet } from "@/lib/wallet-service"
import { sendBookingRequestEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"

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
      result.error === "Insufficient wallet balance"
        ? "Nicht genügend Guthaben im Wallet."
        : result.error || "Zahlung fehlgeschlagen."
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Benachrichtigung an Takumi (wie bei Stripe-Zahlung)
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const respondBase = `${baseUrl}/booking/respond/${booking.id}?token=${booking.statusToken}&action=confirmed`

    await sendBookingRequestEmail({
      to: booking.expertEmail,
      takumiName: booking.expertName,
      userName: booking.userName,
      userEmail: booking.userEmail,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      price: booking.price,
      note: booking.note || "",
      acceptUrl: `${respondBase.replace("action=confirmed", "")}&action=confirmed`,
      declineUrl: `${respondBase.replace("action=confirmed", "")}&action=declined`,
      askUrl: `${respondBase.replace("action=confirmed", "")}&action=ask`,
      dashboardUrl: `${baseUrl}/sessions`,
    })

    if (booking.expert?.userId) {
      await prisma.notification.create({
        data: {
          userId: booking.expert.userId,
          type: "booking_request",
          bookingId: booking.id,
          title: "Neue Buchungsanfrage (bezahlt)",
          body: `${booking.userName} hat eine Session am ${booking.date} von ${booking.startTime}–${booking.endTime} Uhr gebucht und bezahlt.`,
        },
      })
      sendPushToUser(booking.expert.userId, {
        title: "Neue Buchung (bezahlt)",
        body: `${booking.userName} hat am ${booking.date} um ${booking.startTime} Uhr gebucht.`,
        url: "/sessions",
      }).catch(() => {})
    }
  } catch (notifyErr) {
    console.error("[pay-with-wallet] Notification failed:", notifyErr)
  }

  return NextResponse.json({ ok: true, message: "Bezahlung erfolgreich." })
}

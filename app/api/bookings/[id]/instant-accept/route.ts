import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendBookingStatusEmail } from "@/lib/email"
import { bookingPartyDisplayLabels } from "@/lib/booking-party-labels"
import type { BookingStatus } from "@prisma/client"

export const runtime = "nodejs"

/**
 * GET /api/bookings/[id]/instant-accept?token=xxx
 * One-click accept from push notification (Web or deep link).
 * Atomic update to prevent double-accept. Redirects to /session/[id].
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/sessions", req.url))
  }

  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "pending",
      statusToken: token,
      bookingMode: "instant",
    },
    data: { status: "confirmed" as BookingStatus },
  })

  if (updated.count === 0) {
    return NextResponse.redirect(new URL("/sessions", req.url))
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })
  if (booking?.expertId) {
    await prisma.expert.update({
      where: { id: booking.expertId },
      data: { liveStatus: "in_call" },
    })
    try {
      const labels = await bookingPartyDisplayLabels(booking)
      await sendBookingStatusEmail({
        to: booking.userEmail,
        userName: labels.shugyoLabel,
        takumiName: labels.takumiLabel,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: "confirmed",
      })
    } catch {
      /* ignore */
    }
  }

  const base = new URL(req.url).origin
  return NextResponse.redirect(`${base}/session/${bookingId}?connecting=1`)
}

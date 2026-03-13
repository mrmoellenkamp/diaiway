import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendBookingStatusEmail } from "@/lib/email"
import type { BookingStatus } from "@prisma/client"

export const runtime = "nodejs"

/**
 * GET /api/bookings/[id]/instant-decline?token=xxx
 * One-click decline from push notification. Redirects to /sessions.
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
    data: { status: "declined" as BookingStatus },
  })

  if (updated.count > 0) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    })
    if (booking) {
      try {
        await sendBookingStatusEmail({
          to: booking.userEmail,
          userName: booking.userName,
          takumiName: booking.expertName,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: "declined",
        })
      } catch {
        /* ignore */
      }
    }
  }

  return NextResponse.redirect(new URL("/sessions", req.url))
}

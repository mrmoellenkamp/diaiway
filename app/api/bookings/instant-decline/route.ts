import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendBookingStatusEmail } from "@/lib/email"
import type { BookingStatus } from "@prisma/client"

export const runtime = "nodejs"

/**
 * POST /api/bookings/instant-decline
 * Atomic decline for Instant Connect (from Quick Action).
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "takumi") {
    return NextResponse.json({ error: "Nur für Takumi." }, { status: 403 })
  }

  let body: { bookingId?: string; token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 })
  }

  const { bookingId, token } = body
  if (!bookingId || !token) {
    return NextResponse.json({ error: "bookingId und token erforderlich." }, { status: 400 })
  }

  const expert = await prisma.expert.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!expert) {
    return NextResponse.json({ error: "Kein Takumi-Profil gefunden." }, { status: 403 })
  }

  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "pending",
      statusToken: token,
      expertId: expert.id,
      bookingMode: "instant",
    },
    data: { status: "declined" as BookingStatus },
  })

  if (updated.count === 0) {
    return NextResponse.json({ success: true })
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
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

  return NextResponse.json({ success: true })
}

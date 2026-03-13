import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendBookingStatusEmail } from "@/lib/email"
import type { BookingStatus } from "@prisma/client"

export const runtime = "nodejs"

/**
 * POST /api/bookings/instant-accept
 * Atomic accept for Instant Connect. Prevents two Takumis accepting the same request.
 * Same logic as PATCH /api/bookings/[id]/status but with atomic updateMany.
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

  // Atomic: update only if status is still pending and token matches and expert matches
  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "pending",
      statusToken: token,
      expertId: expert.id,
      bookingMode: "instant",
    },
    data: { status: "confirmed" as BookingStatus },
  })

  if (updated.count === 0) {
    const existing = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, expertId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Bereits bearbeitet." }, { status: 409 })
    }
    return NextResponse.json({ error: "Ungültiger Token oder keine Berechtigung." }, { status: 403 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })
  if (!booking) {
    return NextResponse.json({ success: true, status: "confirmed", bookingId })
  }

  await prisma.expert.update({
    where: { id: booking.expertId! },
    data: { liveStatus: "in_call" },
  })

  try {
    await sendBookingStatusEmail({
      to: booking.userEmail,
      userName: booking.userName,
      takumiName: booking.expertName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: "confirmed",
    })
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    success: true,
    status: "confirmed",
    bookingId: booking.id,
  })
}

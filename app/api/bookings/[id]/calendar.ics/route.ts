import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { communicationUsername } from "@/lib/communication-display"
import { buildBookingIcs } from "@/lib/booking-calendar"
import { isScheduledAwaitingStripeCompletion } from "@/lib/booking-display"

export const runtime = "nodejs"

function appOriginFromRequest(req: Request): string {
  const env = process.env.NEXTAUTH_URL?.replace(/\/$/, "")
  if (env) return env
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  if (host) return `${proto}://${host}`
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://diaiway.com"
}

/**
 * GET /api/bookings/[id]/calendar.ics
 * iCalendar feed for the booking (booker or expert only).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id } = await params

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { expert: { include: { user: { select: { username: true } } } } },
    })
    if (!booking) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid
    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: uid },
      select: { isBanned: true },
    })
    if (currentUser?.isBanned) {
      return NextResponse.json({ error: "Dein Zugang wurde gesperrt (diaiway Safety)." }, { status: 403 })
    }

    if (
      booking.status === "cancelled" ||
      booking.status === "declined" ||
      booking.status === "cancelled_in_handshake" ||
      booking.status === "instant_expired"
    ) {
      return NextResponse.json({ error: "Termin nicht verfügbar." }, { status: 410 })
    }

    if (
      isScheduledAwaitingStripeCompletion({
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        bookingMode: booking.bookingMode,
      })
    ) {
      return NextResponse.json({ error: "Kalender nach Zahlungsabschluss verfügbar." }, { status: 409 })
    }

    const takumiDisplay = communicationUsername(booking.expert?.user?.username, booking.expertName || "Takumi")
    const partnerLabel = isExpert ? booking.userName || "Shugyo" : takumiDisplay
    const callLabel = booking.callType === "VOICE" ? "Voice" : "Video"
    const origin = appOriginFromRequest(req)
    const sessionUrl = `${origin}/session/${booking.id}`
    const summary = `diaiway · ${callLabel} · ${partnerLabel}`
    const descriptionLines = [
      `Session mit ${partnerLabel} (diaiway)`,
      "",
      sessionUrl,
    ]
    if (booking.note?.trim()) {
      descriptionLines.push("", booking.note.trim())
    }

    const ics = buildBookingIcs({
      bookingId: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      summary,
      descriptionLines,
      sessionUrl,
    })

    const safeDate = booking.date.replace(/[^0-9-]/g, "") || "termin"
    const filename = `diaiway-termin-${safeDate}.ics`

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    console.error("[calendar.ics]", e)
    return NextResponse.json({ error: "Kalenderdatei konnte nicht erstellt werden." }, { status: 500 })
  }
}

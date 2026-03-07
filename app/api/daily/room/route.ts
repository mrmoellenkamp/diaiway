import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/daily/room?bookingId=xxx
 * Returns the Daily.co room URL for a booking. Creates the room via Daily REST API
 * if it doesn't exist yet. Requires the caller to be the booker or the expert.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const bookingId = req.nextUrl.searchParams.get("bookingId")
  if (!bookingId || !/^[a-zA-Z0-9_-]{1,50}$/.test(bookingId)) {
    return NextResponse.json({ error: "Ungültige Buchungs-ID." }, { status: 400 })
  }

  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "Video-Service nicht konfiguriert (DAILY_API_KEY fehlt)." },
      { status: 500 }
    )
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { expert: true },
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

    if (booking.status !== "confirmed" && booking.status !== "active") {
      return NextResponse.json(
        { error: `Video-Raum nur bei Status confirmed/active. Aktuell: ${booking.status}` },
        { status: 400 }
      )
    }

    // Use existing room URL if we have one
    if (booking.dailyRoomUrl?.trim()) {
      return NextResponse.json({ roomUrl: booking.dailyRoomUrl })
    }

    // Create room via Daily REST API
    const roomName = bookingId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128)
    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: { max_participants: 2 },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error("[Daily] Room creation failed:", res.status, errBody)
      return NextResponse.json(
        { error: "Video-Raum konnte nicht erstellt werden. Bitte später erneut versuchen." },
        { status: 502 }
      )
    }

    const room = (await res.json()) as { url?: string }
    const roomUrl = room?.url
    if (!roomUrl) {
      return NextResponse.json(
        { error: "Ungültige Antwort vom Video-Service." },
        { status: 502 }
      )
    }

    // Persist room URL so both parties use the same room
    await prisma.booking.update({
      where: { id: bookingId },
      data: { dailyRoomUrl: roomUrl },
    })

    return NextResponse.json({ roomUrl })
  } catch (err) {
    console.error("[Daily] Room API error:", err)
    return NextResponse.json(
      { error: "Interner Fehler beim Erstellen des Video-Raums." },
      { status: 500 }
    )
  }
}

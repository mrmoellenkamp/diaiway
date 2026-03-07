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

    const roomName = bookingId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128)
    let baseRoomUrl: string
    let effectiveRoomName: string

    // Use existing room URL if we have one, otherwise create room
    if (booking.dailyRoomUrl?.trim()) {
      baseRoomUrl = booking.dailyRoomUrl
      // Extract room name from URL (e.g. https://domain.daily.co/roomname -> roomname)
      effectiveRoomName = baseRoomUrl.split("/").pop()?.split("?")[0] || roomName
    } else {
      const res = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: "private", // Nur mit gültigem Token beitretbar
          properties: {
            max_participants: 2,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // Raum läuft nach 7 Tagen ab
          },
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
      baseRoomUrl = room?.url
      if (!baseRoomUrl) {
        return NextResponse.json(
          { error: "Ungültige Antwort vom Video-Service." },
          { status: 502 }
        )
      }

      await prisma.booking.update({
        where: { id: bookingId },
        data: { dailyRoomUrl: baseRoomUrl },
      })
      effectiveRoomName = roomName
    }

    // Meeting-Token serverseitig generieren — ohne Token kein Zugang (private room)
    const userName = session.user.name || (isBooker ? booking.userName : booking.expertName) || "Teilnehmer"
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2 Stunden
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: effectiveRoomName,
          user_name: userName,
          user_id: uid.slice(0, 36),
          exp,
          is_owner: true,
        },
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error("[Daily] Token creation failed:", tokenRes.status, errBody)
      return NextResponse.json(
        { error: "Video-Token konnte nicht erstellt werden. Bitte später erneut versuchen." },
        { status: 502 }
      )
    }

    const tokenData = (await tokenRes.json()) as { token?: string }
    const token = tokenData?.token
    const roomUrl = token
      ? `${baseRoomUrl}${baseRoomUrl.includes("?") ? "&" : "?"}t=${token}`
      : baseRoomUrl

    return NextResponse.json({ roomUrl })
  } catch (err) {
    console.error("[Daily] Room API error:", err)
    return NextResponse.json(
      { error: "Interner Fehler beim Erstellen des Video-Raums." },
      { status: 500 }
    )
  }
}

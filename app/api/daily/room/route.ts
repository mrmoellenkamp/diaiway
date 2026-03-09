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

    // Use existing room URL if we have one
    if (booking.dailyRoomUrl?.trim()) {
      baseRoomUrl = booking.dailyRoomUrl
      effectiveRoomName = baseRoomUrl.split("/").pop()?.split("?")[0] || roomName
    } else {
      // Try GET first — vermeidet Doppel-Erstellung bei parallelen Requests (Shugyo + Takumi)
      const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (getRes.ok) {
        const existing = (await getRes.json()) as { url?: string }
        baseRoomUrl = existing?.url ?? ""
      }
      if (!baseRoomUrl?.trim()) {
        const res = await fetch("https://api.daily.co/v1/rooms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            name: roomName,
            privacy: "private",
            properties: {
              max_participants: 2,
              exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
              enable_prejoin_ui: true, // Lobby mit Kamera-/Mikro-Check vor dem Beitritt
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
        baseRoomUrl = room?.url ?? ""
      }
      if (!baseRoomUrl?.trim()) {
        return NextResponse.json(
          { error: "Ungültige Antwort vom Video-Service." },
          { status: 502 }
        )
      }
      effectiveRoomName = roomName

      // Nur aktualisieren wenn noch leer — verhindert Race: zweiter Request nutzt DB-Wert
      const updated = await prisma.booking.updateMany({
        where: { id: bookingId, dailyRoomUrl: "" },
        data: { dailyRoomUrl: baseRoomUrl },
      })
      if (updated.count === 0) {
        const fresh = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: { dailyRoomUrl: true },
        })
        if (fresh?.dailyRoomUrl?.trim()) baseRoomUrl = fresh.dailyRoomUrl
      }
    }

    // Meeting-Token serverseitig generieren — ohne Token kein Zugang (private room)
    const userName = session.user.name || (isBooker ? booking.userName : booking.expertName) || "Teilnehmer"
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2 Stunden
    const isVoiceCall = booking.callType === "VOICE"
    const tokenProperties: Record<string, unknown> = {
      room_name: effectiveRoomName,
      user_name: userName,
      user_id: uid.slice(0, 36),
      exp,
      is_owner: true,
    }
    if (isVoiceCall) {
      // Voice-Call: Video deaktivieren, nur Audio erlauben
      tokenProperties.start_video_off = true
      tokenProperties.enable_screenshare = false
      tokenProperties.permissions = { canSend: ["audio"] }
    } else {
      // Video-Call: Kamera und Mikro explizit einschalten, Prejoin-UI für Geräteprüfung
      tokenProperties.start_video_off = false
      tokenProperties.start_audio_off = false
      tokenProperties.enable_prejoin_ui = true
    }
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: tokenProperties,
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

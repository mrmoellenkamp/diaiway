import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

type CallMode = "voice" | "video"

function parseCallMode(val: string | null): CallMode {
  if (val === "voice" || val === "video") return val
  return "video"
}

/**
 * GET /api/daily/meeting-room?bookingId=xxx&callMode=voice|video
 * POST /api/daily/meeting-room { bookingId, callMode }
 * Erzeugt Daily-Raum + Token für Custom-UI-Modus (createCallObject, Lobby-Architektur).
 * Token: is_owner: false. callMode: voice → Nur Audio; video → Kamera möglich.
 */
async function handleMeetingRoom(
  bookingId: string,
  callMode: CallMode,
  session: { user: { id: string; name?: string } }
) {

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
        { error: `Raum nur bei Status confirmed/active. Aktuell: ${booking.status}` },
        { status: 400 }
      )
    }

    const roomName = bookingId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128)
    let baseRoomUrl: string
    let effectiveRoomName: string

    if (booking.dailyRoomUrl?.trim()) {
      baseRoomUrl = booking.dailyRoomUrl.replace(/\?.*$/, "").replace(/\/+$/, "")
      const pathSegment = baseRoomUrl.split("/").pop()
      effectiveRoomName = pathSegment?.split("?")[0]?.trim() || roomName
    } else {
      const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (getRes.ok) {
        const existing = (await getRes.json()) as { url?: string; name?: string }
        baseRoomUrl = existing?.url ?? ""
        effectiveRoomName = existing?.name ?? roomName
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
              enable_prejoin_ui: false, // Custom-UI: kein Prejoin
            },
          }),
        })
        if (!res.ok) {
          const errBody = await res.text()
          console.error("[Daily] Room creation failed:", res.status, errBody)
          return NextResponse.json(
            { error: "Video-Raum konnte nicht erstellt werden." },
            { status: 502 }
          )
        }
        const room = (await res.json()) as { url?: string; name?: string }
        baseRoomUrl = room?.url ?? ""
        effectiveRoomName = room?.name ?? roomName
      }
      if (!baseRoomUrl?.trim()) {
        return NextResponse.json({ error: "Ungültige Antwort vom Video-Service." }, { status: 502 })
      }
      if (!effectiveRoomName) effectiveRoomName = roomName

      await prisma.booking.updateMany({
        where: { id: bookingId, dailyRoomUrl: "" },
        data: { dailyRoomUrl: baseRoomUrl },
      })
    }

    const userName = session.user.name || (isBooker ? booking.userName : booking.expertName) || "Teilnehmer"
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2
    const tokenProperties: Record<string, unknown> = {
      room_name: effectiveRoomName,
      user_name: userName,
      user_id: uid.slice(0, 36),
      exp,
      is_owner: false,
    }

    if (callMode === "voice") {
      // Voice: Nur Audio, kein Video (permissions + videoSource: false im Client)
      tokenProperties.start_video_off = true
      tokenProperties.enable_screenshare = false
      tokenProperties.permissions = { canSend: ["audio"] }
    } else {
      // Video: Kamera/Mikro, start_video_off: true (Privatsphäre beim Beitritt)
      tokenProperties.start_video_off = true
      tokenProperties.start_audio_off = false
    }

    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ properties: tokenProperties }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error("[Daily] Token creation failed:", tokenRes.status, errBody)
      return NextResponse.json({ error: "Video-Token konnte nicht erstellt werden." }, { status: 502 })
    }

    const tokenData = (await tokenRes.json()) as { token?: string }
    const token = tokenData?.token
    const roomUrl = token
      ? `${baseRoomUrl}${baseRoomUrl.includes("?") ? "&" : "?"}t=${token}`
      : baseRoomUrl

    return NextResponse.json({ roomUrl, callMode })
  } catch (err) {
    console.error("[Daily] meeting-room error:", err)
    return NextResponse.json(
      { error: "Interner Fehler beim Erstellen des Meeting-Raums." },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }
  const bookingId = req.nextUrl.searchParams.get("bookingId")
  const callMode = parseCallMode(req.nextUrl.searchParams.get("callMode"))
  if (!bookingId || !/^[a-zA-Z0-9_-]{1,50}$/.test(bookingId)) {
    return NextResponse.json({ error: "Ungültige Buchungs-ID." }, { status: 400 })
  }
  return handleMeetingRoom(bookingId, callMode, session)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }
  let body: { bookingId?: string; callMode?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 })
  }
  const bookingId = body?.bookingId
  const callMode = parseCallMode(body?.callMode ?? null)
  if (!bookingId || !/^[a-zA-Z0-9_-]{1,50}$/.test(bookingId)) {
    return NextResponse.json({ error: "Ungültige Buchungs-ID." }, { status: 400 })
  }
  return handleMeetingRoom(bookingId, callMode, session)
}

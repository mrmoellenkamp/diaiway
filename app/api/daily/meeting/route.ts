import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { parseBerlinDateTime } from "@/lib/date-utils"

export const runtime = "nodejs"

const DAILY_API_BASE = "https://api.daily.co/v1"

type CallMode = "video" | "voice"
type UserRole = "shugyo" | "takumi"

interface MeetingRequestBody {
  bookingId: string
  callMode: CallMode
  userRole: UserRole
}

function isValidCallMode(v: unknown): v is CallMode {
  return v === "video" || v === "voice"
}

function isValidUserRole(v: unknown): v is UserRole {
  return v === "shugyo" || v === "takumi"
}

/**
 * POST /api/daily/meeting
 * Erstellt einen Daily-Raum und einen Meeting-Token für Video- oder Voice-Calls.
 * Body: { bookingId, callMode, userRole }
 */
export async function POST(req: Request) {
  console.log("[Daily Meeting] Daily API Key Check:", !!process.env.DAILY_API_KEY)

  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey?.trim()) {
    console.error("[Daily Meeting] DAILY_API_KEY fehlt oder ist leer.")
    return NextResponse.json({ error: "Video-API nicht konfiguriert." }, { status: 503 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const { bookingId, callMode, userRole } = (body || {}) as MeetingRequestBody
  if (!bookingId || typeof bookingId !== "string" || !bookingId.trim()) {
    return NextResponse.json({ error: "bookingId ist erforderlich." }, { status: 400 })
  }
  if (!isValidCallMode(callMode)) {
    return NextResponse.json({ error: "callMode muss 'video' oder 'voice' sein." }, { status: 400 })
  }
  if (!isValidUserRole(userRole)) {
    return NextResponse.json({ error: "userRole muss 'shugyo' oder 'takumi' sein." }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId.trim() },
    include: { expert: { select: { userId: true } } },
  })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }
  const isShugyo = booking.userId === session.user.id
  const isTakumi = booking.expert?.userId === session.user.id
  if (!isShugyo && !isTakumi) {
    return NextResponse.json({ error: "Keine Berechtigung für diese Buchung." }, { status: 403 })
  }
  if ((userRole === "shugyo" && !isShugyo) || (userRole === "takumi" && !isTakumi)) {
    return NextResponse.json({ error: "userRole stimmt nicht mit deiner Rolle in dieser Buchung überein." }, { status: 403 })
  }

  const endAt = parseBerlinDateTime(booking.date, booking.endTime || booking.startTime || "00:00")
  const now = new Date()
  if (["pending", "confirmed"].includes(booking.status) && endAt <= now) {
    return NextResponse.json(
      { error: "Diese Buchung ist abgelaufen und kann nicht mehr gestartet werden." },
      { status: 409 }
    )
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  const roomName = `room-${bookingId.trim()}`

  const now = Math.floor(Date.now() / 1000)
  const expValue = now + 3600
  const nbfValue = now - 60

  const roomPayload = {
    name: roomName,
    privacy: "public",
    properties: {
      exp: expValue,
      // Keep calls in P2P mode for up to 2 participants (Shugyo + Takumi).
      // P2P = media flows directly between devices, never decrypted on Daily's
      // servers → true end-to-end encryption. Switches to SFU only if a 3rd
      // participant somehow joins (prevents accidental downgrade).
      sfu_switchover: 2,
      // Hard-cap at 2 participants so the room can never become a group call
      // without explicit product decision.
      max_participants: 2,
    },
  }
  console.log("[Daily Meeting] Request to Daily (rooms):", JSON.stringify(roomPayload))
  console.log("API SENDING exp:", expValue, "nbf:", nbfValue)

  try {
    let roomUrl: string | null = null

    const roomRes = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers,
      body: JSON.stringify(roomPayload),
    })

    if (roomRes.ok) {
      const roomData = (await roomRes.json()) as { url?: string; name?: string }
      roomUrl = roomData?.url ?? null
    } else {
      const errText = await roomRes.text()
      const isRoomExists = roomRes.status === 409 || errText.toLowerCase().includes("already exists")
      if (isRoomExists) {
        const getRes = await fetch(`${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`, {
          method: "GET",
          headers,
        })
        if (getRes.ok) {
          const existingRoom = (await getRes.json()) as { url?: string; name?: string }
          roomUrl = existingRoom?.url ?? null
        }
      }
      if (!roomUrl) {
        let errorData: { info?: string; error?: string } = {}
        try {
          errorData = JSON.parse(errText) as { info?: string; error?: string }
        } catch {
          // errText bleibt als Fallback
        }
        console.error("[Daily Meeting] Raum-Erstellung fehlgeschlagen:", roomRes.status, errText)
        const errorMsg =
          errorData?.info ?? errorData?.error ?? "Raum konnte nicht erstellt werden."
        return NextResponse.json({ error: errorMsg }, { status: 502 })
      }
    }

    if (!roomUrl) {
      console.error("[Daily Meeting] Raum-Response ohne url für:", roomName)
      return NextResponse.json(
        { error: "Ungültige Antwort der Video-API." },
        { status: 502 }
      )
    }

    const tokenPayload = {
      properties: {
        room_name: roomName,
        is_owner: userRole === "takumi",
        user_name: session.user?.name ?? "Teilnehmer",
        exp: expValue,
        nbf: nbfValue,
        eject_at_token_exp: true,
      },
    }
    console.log("[Daily Meeting] Request to Daily (meeting-tokens):", JSON.stringify(tokenPayload))
    console.log("API SENDING exp:", expValue, "nbf:", nbfValue)

    const tokenRes = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
      method: "POST",
      headers,
      body: JSON.stringify(tokenPayload),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      let errorData: { info?: string; error?: string } = {}
      try {
        errorData = JSON.parse(errText) as { info?: string; error?: string }
      } catch {
        // errText bleibt als Fallback
      }
      console.error("[Daily Meeting] Token-Erstellung fehlgeschlagen:", tokenRes.status, errText)
      console.error("[Daily Meeting] Daily API Error Detail:", errorData)
      const errorMsg =
        errorData?.info ?? errorData?.error ?? "Meeting-Token konnte nicht erstellt werden."
      return NextResponse.json({ error: errorMsg }, { status: 502 })
    }

    const tokenData = (await tokenRes.json()) as { token?: string }
    const meetingToken = tokenData?.token
    if (!meetingToken) {
      console.error("[Daily Meeting] Token-Response ohne token:", tokenData)
      return NextResponse.json(
        { error: "Ungültige Token-Antwort der Video-API." },
        { status: 502 }
      )
    }

    return NextResponse.json({
      url: roomUrl,
      token: meetingToken,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Daily Meeting] Fehler:", msg)
    if (err instanceof Error && err.cause) {
      console.error("[Daily Meeting] Fehler-Cause:", err.cause)
    }
    return NextResponse.json(
      { error: "Video-Service vorübergehend nicht erreichbar." },
      { status: 503 }
    )
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

const DAILY_API_BASE = "https://api.daily.co/v1"

/**
 * POST /api/guest/meeting
 * Creates (or retrieves) a Daily.co room for a guest call and returns a meeting token.
 * Authenticated by guestToken — no NextAuth session required.
 *
 * Body: { guestToken }
 *
 * The room is created with sfu_switchover: 2 (P2P/E2EE for 2 participants).
 * Guest receives a non-owner token; Takumi gets owner token via /api/daily/meeting.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`guest-meeting:${ip}`, { limit: 20, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 })
  }

  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "Video-API nicht konfiguriert." }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 })
  }

  const { guestToken } = body
  if (!guestToken || typeof guestToken !== "string") {
    return NextResponse.json({ error: "guestToken fehlt." }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken },
    select: {
      id: true,
      paymentStatus: true,
      isGuestCall: true,
      status: true,
      date: true,
      startTime: true,
      endTime: true,
      guestEmail: true,
      expert: { select: { name: true } },
    },
  })

  if (!booking || !booking.isGuestCall) {
    return NextResponse.json({ error: "Einladung nicht gefunden." }, { status: 404 })
  }
  if (booking.paymentStatus !== "paid") {
    return NextResponse.json({ error: "Zahlung noch nicht bestätigt." }, { status: 402 })
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  const roomName = `room-${booking.id}`
  const nowUnix = Math.floor(Date.now() / 1000)
  const expValue = nowUnix + 3600
  const nbfValue = nowUnix - 60

  // Create or retrieve the Daily room
  let roomUrl: string | null = null

  const roomPayload = {
    name: roomName,
    privacy: "public",
    properties: {
      exp: expValue,
      sfu_switchover: 2,   // P2P for ≤2 participants → E2EE
      max_participants: 2,
    },
  }

  const roomRes = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers,
    body: JSON.stringify(roomPayload),
  })

  if (roomRes.ok) {
    const roomData = (await roomRes.json()) as { url?: string }
    roomUrl = roomData?.url ?? null
  } else {
    const errText = await roomRes.text()
    const isExists = roomRes.status === 409 || errText.toLowerCase().includes("already exists")
    if (isExists) {
      const getRes = await fetch(`${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`, {
        method: "GET",
        headers,
      })
      if (getRes.ok) {
        const existing = (await getRes.json()) as { url?: string }
        roomUrl = existing?.url ?? null
      }
    }
    if (!roomUrl) {
      console.error("[Guest Meeting] Room creation failed:", roomRes.status, errText)
      return NextResponse.json({ error: "Video-Raum konnte nicht erstellt werden." }, { status: 502 })
    }
  }

  if (!roomUrl) {
    return NextResponse.json({ error: "Ungültige Antwort der Video-API." }, { status: 502 })
  }

  // Also store the room URL in the booking for the Takumi's polling
  await prisma.booking.update({
    where: { id: booking.id },
    data: { dailyRoomUrl: roomUrl },
  }).catch((err) => console.error("[Guest Meeting] Failed to store dailyRoomUrl:", err))

  // Create a guest (non-owner) meeting token
  const tokenPayload = {
    properties: {
      room_name: roomName,
      is_owner: false,
      user_name: booking.guestEmail ?? "Gast",
      exp: expValue,
      nbf: nbfValue,
      eject_at_token_exp: true,
    },
  }

  const tokenRes = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers,
    body: JSON.stringify(tokenPayload),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error("[Guest Meeting] Token creation failed:", tokenRes.status, errText)
    return NextResponse.json({ error: "Meeting-Token konnte nicht erstellt werden." }, { status: 502 })
  }

  const tokenData = (await tokenRes.json()) as { token?: string }
  const meetingToken = tokenData?.token
  if (!meetingToken) {
    return NextResponse.json({ error: "Ungültige Token-Antwort der Video-API." }, { status: 502 })
  }

  return NextResponse.json({
    url: roomUrl,
    token: meetingToken,
    bookingId: booking.id,
    takumiName: booking.expert?.name ?? "Takumi",
  })
}

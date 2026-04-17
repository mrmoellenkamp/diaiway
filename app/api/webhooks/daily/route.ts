import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { terminateSessionForBooking } from "@/lib/session-terminate"
import crypto from "crypto"
import { logSecureError, logSecureWarn } from "@/lib/log-redact"

export const runtime = "nodejs"

const ROOM_PREFIX = "room-"

function extractBookingId(room: string): string | null {
  if (!room?.startsWith(ROOM_PREFIX)) return null
  return room.slice(ROOM_PREFIX.length).trim() || null
}

/**
 * HMAC-SHA256 Signaturprüfung für Daily-Webhooks.
 *
 * Wichtig:
 *  - Beide Buffers müssen exakt gleiche Länge haben, sonst wirft
 *    `crypto.timingSafeEqual` einen TypeError. Deshalb expliziter Längencheck
 *    vor dem Vergleich — bei Nicht-Übereinstimmung abbrechen (konstante Zeit).
 *  - base64-Output, wie von Daily dokumentiert.
 */
function verifyWebhook(body: string, signature: string | null, secret: string): boolean {
  if (!secret?.trim() || !signature) return false
  try {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64")
    const receivedBuf = Buffer.from(signature)
    const expectedBuf = Buffer.from(expected)
    if (receivedBuf.length !== expectedBuf.length) return false
    return crypto.timingSafeEqual(receivedBuf, expectedBuf)
  } catch {
    return false
  }
}

/**
 * POST /api/webhooks/daily
 * Daily.co webhook: participant.left, participant.joined
 * Configure in Daily dashboard: https://dashboard.daily.co/webhooks
 */
export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get("x-webhook-signature") ?? req.headers.get("x-daily-signature")
  const secret = process.env.DAILY_WEBHOOK_SECRET

  if (!secret?.trim()) {
    logSecureError("daily-webhook", "DAILY_WEBHOOK_SECRET not configured")
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
    }
  } else if (!verifyWebhook(body, signature, secret)) {
    logSecureWarn("daily-webhook", "Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: { type?: string; payload?: { room?: string; session_id?: string } }
  try {
    payload = JSON.parse(body) as { type?: string; payload?: { room?: string; session_id?: string } }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { type, payload: p } = payload
  const room = p?.room
  const sessionId = p?.session_id ?? ""

  if (!room) {
    return NextResponse.json({ ok: true })
  }

  if (type === "participant.left") {
    try {
      await prisma.dailyParticipantLeft.create({
        data: {
          room,
          sessionId: sessionId || "unknown",
        },
      })
    } catch (e) {
      logSecureError("daily-webhook.participant.left", e)
    }
  } else if (type === "participant.joined") {
    try {
      const since = new Date(Date.now() - 65_000)
      await prisma.dailyParticipantLeft.updateMany({
        where: {
          room,
          leftAt: { gte: since },
          cancelledAt: null,
        },
        data: { cancelledAt: new Date() },
      })
    } catch (e) {
      logSecureError("daily-webhook.participant.joined", e)
    }
  } else if (type === "meeting.ended") {
    const bookingId = extractBookingId(room)
    if (bookingId) {
      try {
        await terminateSessionForBooking(bookingId)
      } catch (e) {
        logSecureError("daily-webhook.meeting.ended", e)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

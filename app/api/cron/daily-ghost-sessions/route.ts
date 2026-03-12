import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { terminateSessionForBooking } from "@/lib/session-terminate"

export const runtime = "nodejs"
export const maxDuration = 60

const ROOM_PREFIX = "room-"
const GHOST_WAIT_SEC = 60

function extractBookingId(room: string): string | null {
  if (!room?.startsWith(ROOM_PREFIX)) return null
  return room.slice(ROOM_PREFIX.length).trim() || null
}

/**
 * Cron: Ghost Sessions – participant.left ohne Rejoin nach 60s → terminate (Case A/B)
 * Verhindert "verwaiste" Sessions (z.B. App-Absturz, Netzabbruch).
 * Optional: CRON_SECRET oder DAILY_GHOST_SECRET zur Absicherung.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? process.env.DAILY_GHOST_SECRET
  if (!cronSecret?.trim()) {
    console.error("[Cron] daily-ghost: No CRON_SECRET or DAILY_GHOST_SECRET – refusing")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - GHOST_WAIT_SEC * 1000)

  const pending = await prisma.dailyParticipantLeft.findMany({
    where: {
      leftAt: { lt: cutoff },
      cancelledAt: null,
    },
  })

  const results: { bookingId: string; ok: boolean; status?: string; error?: string }[] = []

  for (const p of pending) {
    const bookingId = extractBookingId(p.room)
    if (!bookingId) {
      await prisma.dailyParticipantLeft.update({
        where: { id: p.id },
        data: { cancelledAt: new Date() },
      })
      continue
    }

    const result = await terminateSessionForBooking(bookingId)
    results.push({
      bookingId,
      ok: result.ok,
      status: result.ok ? result.status : undefined,
      error: result.ok ? undefined : result.error,
    })

    await prisma.dailyParticipantLeft.delete({ where: { id: p.id } }).catch(() => {})
  }

  return NextResponse.json({
    processed: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    details: results,
  })
}

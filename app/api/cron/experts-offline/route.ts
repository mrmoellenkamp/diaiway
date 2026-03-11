import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const STALE_MS = 3 * 60 * 1000 // 3 Minuten

/**
 * GET/POST /api/cron/experts-offline
 * Setzt Experten mit lastSeenAt älter als 3 Min. auf offline.
 * Sichern: CRON_SECRET prüfen (Vercel sendet Authorization: Bearer <CRON_SECRET>).
 */
async function runExpertsOffline() {

  const cutoff = new Date(Date.now() - STALE_MS)

  const result = await prisma.expert.updateMany({
    where: {
      liveStatus: "available",
      OR: [
        { lastSeenAt: { lt: cutoff } },
        { lastSeenAt: null },
      ],
    },
    data: { liveStatus: "offline" },
  })

  return { ok: true, updated: result.count }
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    console.error("[Cron] experts-offline: CRON_SECRET not configured")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await runExpertsOffline()
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    console.error("[Cron] experts-offline: CRON_SECRET not configured")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await runExpertsOffline()
  return NextResponse.json(result)
}

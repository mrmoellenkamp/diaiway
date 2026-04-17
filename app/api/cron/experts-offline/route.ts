import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { TAKUMI_STALE_OFFLINE_SEC } from "@/lib/session-activity"
import { assertCronAuthorized } from "@/lib/cron-auth"

const STALE_MS = TAKUMI_STALE_OFFLINE_SEC * 1000

/**
 * GET/POST /api/cron/experts-offline
 * Setzt Experten mit lastSeenAt älter als 5 Min. auf offline.
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
  const authErr = assertCronAuthorized(req, "experts-offline")
  if (authErr) return authErr
  const result = await runExpertsOffline()
  await prisma.cronRunLog.upsert({
    where: { cronName: "experts-offline" },
    create: { cronName: "experts-offline", lastRunAt: new Date() },
    update: { lastRunAt: new Date() },
  }).catch(() => {})
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const authErr = assertCronAuthorized(req, "experts-offline")
  if (authErr) return authErr
  const result = await runExpertsOffline()
  await prisma.cronRunLog.upsert({
    where: { cronName: "experts-offline" },
    create: { cronName: "experts-offline", lastRunAt: new Date() },
    update: { lastRunAt: new Date() },
  }).catch(() => {})
  return NextResponse.json(result)
}

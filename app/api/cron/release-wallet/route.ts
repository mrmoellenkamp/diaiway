import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { processPendingCompletions } from "@/app/actions/process-completion"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron: 24h nach Session-Ende → Capture, RE/GS erzeugen, Takumi-Guthaben gutschreiben.
 * Hold & Capture Modell: Verarbeitet AUTHORIZED Transaktionen.
 * Optional: CRON_SECRET zur Absicherung.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    console.error("[Cron] CRON_SECRET not configured – refusing to run")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await processPendingCompletions()
    const ok = results.filter((r) => r.ok).length
    const failed = results.filter((r) => !r.ok)
    await prisma.cronRunLog.upsert({
      where: { cronName: "release-wallet" },
      create: { cronName: "release-wallet", lastRunAt: new Date() },
      update: { lastRunAt: new Date() },
    }).catch(() => {})
    return NextResponse.json({
      processed: ok,
      failed: failed.length,
      details: results,
    })
  } catch (err) {
    console.error("[Cron] release-wallet error:", err)
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    )
  }
}

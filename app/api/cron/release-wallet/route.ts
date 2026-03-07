import { NextRequest, NextResponse } from "next/server"
import { releasePendingTransactions } from "@/lib/wallet-service"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron: 24h-Freigabe von pending Transaktionen.
 * Aufruf z.B. via Vercel Cron (vercel.json) oder externem Scheduler.
 * Optional: CRON_SECRET zur Absicherung.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await releasePendingTransactions()
    const ok = results.filter((r) => r.ok).length
    const failed = results.filter((r) => !r.ok)
    return NextResponse.json({
      released: ok,
      failed: failed.length,
      details: results,
    })
  } catch (err) {
    console.error("[Cron] release-wallet error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

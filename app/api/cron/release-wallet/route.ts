import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { processPendingCompletions } from "@/app/actions/process-completion"
import { assertCronAuthorized } from "@/lib/cron-auth"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron: 24h nach Session-Ende → Capture, RE/GS erzeugen, Takumi-Guthaben gutschreiben.
 * Hold & Capture Modell: Verarbeitet AUTHORIZED Transaktionen.
 * Optional: CRON_SECRET zur Absicherung.
 */
export async function GET(req: NextRequest) {
  const authErr = assertCronAuthorized(req, "release-wallet")
  if (authErr) return authErr

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
    logSecureError("cron.release-wallet", err)
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    )
  }
}

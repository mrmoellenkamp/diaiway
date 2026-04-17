import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { assertRateLimit } from "@/lib/api-rate-limit"

/**
 * POST /api/expert/heartbeat
 * Instant-Connect: Hält liveStatus=available aktiv. Nur wenn Status bereits available.
 * Takumi ruft alle 2 Min auf, solange er "bereit für Anklopf" ist.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  // 60/Minute pro Takumi deckt normal-Takt deutlich ab, bremst Dauerflood.
  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "expert:heartbeat", limit: 60, windowSec: 60 }
  )
  if (rl) return rl

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "takumi") {
    return NextResponse.json({ error: "Nur für Takumi." }, { status: 403 })
  }

  try {
    await prisma.expert.updateMany({
      where: { userId: session.user.id },
      data: { lastSeenAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Fehler beim Heartbeat." }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { LAST_ACTIVITY_COOKIE, INACTIVITY_TIMEOUT_SEC } from "@/lib/session-activity"
import { assertRateLimit } from "@/lib/api-rate-limit"

/**
 * GET /api/auth/heartbeat
 * Resets the 15-min inactivity cookie (middleware). Alle eingeloggten Rollen —
 * Admins brauchen dasselbe für „Sitzung verlängern“, sonst bleibt der Cookie
 * unverändert und nur Shugyo/Takumi könnten die Warnung sinnvoll quittieren.
 * Used by Video-Call (useHeartbeat) and SessionTimeoutWarning ("Sitzung verlängern").
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  // 180/Minute pro Nutzer ist bei 1-Hz-Heartbeat weit ausreichend; DDoS-sicher.
  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "auth:heartbeat", limit: 180, windowSec: 60 }
  )
  if (rl) return rl

  const now = Math.floor(Date.now() / 1000).toString()
  const response = NextResponse.json({ ok: true })
  const isSecure = process.env.NODE_ENV === "production"

  response.cookies.set(LAST_ACTIVITY_COOKIE, now, {
    path: "/",
    maxAge: INACTIVITY_TIMEOUT_SEC + 60,
    sameSite: "lax",
    secure: isSecure,
    httpOnly: true,
  })

  return response
}

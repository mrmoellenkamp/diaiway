import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { LAST_ACTIVITY_COOKIE, INACTIVITY_TIMEOUT_SEC } from "@/lib/session-activity"

/**
 * GET /api/auth/heartbeat
 * Resets the 15-min inactivity timer. Only for authenticated shugyo/takumi.
 * Used by Video-Call (useHeartbeat) and SessionTimeoutWarning ("Sitzung verlängern").
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "shugyo" && appRole !== "takumi") {
    return NextResponse.json({ error: "Heartbeat nur für Shugyo/Takumi." }, { status: 403 })
  }

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

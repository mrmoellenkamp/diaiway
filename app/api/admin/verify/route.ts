import { NextResponse } from "next/server"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`admin-verify:ip:${ip}`, { limit: 5, windowSec: 300 })
  if (!rl.success) {
    return NextResponse.json(
      { error: "Zu viele Versuche. Bitte warte kurz." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    )
  }

  const { password } = await req.json()
  const adminPw = process.env.ADMIN_PASSWORD

  if (!adminPw) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD ist nicht konfiguriert." },
      { status: 500 }
    )
  }

  if (password === adminPw) {
    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { error: "Falsches Passwort." },
    { status: 401 }
  )
}

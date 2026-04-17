import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"

/**
 * POST /api/push/fcm-token
 * Register FCM/APNs token for native push (Capacitor).
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "push:fcm", limit: 20, windowSec: 3600 }
  )
  if (rl) return rl

  try {
    const body = await req.json()
    const { token } = body as { token?: string }

    if (!token || typeof token !== "string" || token.length < 10 || token.length > 4096) {
      return NextResponse.json({ error: "token erforderlich." }, { status: 400 })
    }

    await prisma.fcmToken.upsert({
      where: { token },
      create: {
        userId: session.user.id,
        token,
      },
      update: {
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    logSecureError("push.fcm", err)
    return NextResponse.json(
      { error: "Token konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}

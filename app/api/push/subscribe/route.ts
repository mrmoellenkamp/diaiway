import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeWebPushKey } from "@/lib/push-subscription-keys"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"

/**
 * POST /api/push/subscribe
 * Save the user's Web Push subscription for sending notifications.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  // 20 Subscribe-Updates/Stunde reichen weit aus.
  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "push:subscribe", limit: 20, windowSec: 3600 }
  )
  if (rl) return rl

  try {
    const body = await req.json()
    const { endpoint, keys } = body as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "endpoint und keys (p256dh, auth) erforderlich." },
        { status: 400 }
      )
    }

    if (typeof endpoint !== "string" || endpoint.length > 2000 || !/^https:\/\//i.test(endpoint)) {
      return NextResponse.json({ error: "Ungültiger endpoint." }, { status: 400 })
    }

    const p256dh = normalizeWebPushKey(keys.p256dh.trim())
    const authKey = normalizeWebPushKey(keys.auth.trim())

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId: session.user.id, endpoint },
      },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh,
        auth: authKey,
      },
      update: {
        p256dh,
        auth: authKey,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    logSecureError("push.subscribe", err)
    return NextResponse.json(
      { error: "Abonnement konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}

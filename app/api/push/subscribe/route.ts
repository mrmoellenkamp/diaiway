import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeWebPushKey } from "@/lib/push-subscription-keys"

export const runtime = "nodejs"

/**
 * POST /api/push/subscribe
 * Save the user's Web Push subscription for sending notifications.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

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
    console.error("[Push] Subscribe error:", err)
    return NextResponse.json(
      { error: "Abonnement konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}

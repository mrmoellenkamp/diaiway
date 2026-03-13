import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/push/fcm-token
 * Register FCM/APNs token for native push (Capacitor).
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { token } = body as { token?: string }

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "token erforderlich." },
        { status: 400 }
      )
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
    console.error("[Push] FCM token error:", err)
    return NextResponse.json(
      { error: "Token konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}

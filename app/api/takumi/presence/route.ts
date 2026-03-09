import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/takumi/presence
 * Takumi-Präsenz: aktualisiert lastSeenAt. Nur für appRole=takumi.
 * Wird vom useTakumiPresence-Hook alle ~2 Min aufgerufen.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

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
    return NextResponse.json({ error: "Fehler beim Aktualisieren." }, { status: 500 })
  }
}

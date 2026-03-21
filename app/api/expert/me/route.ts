import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { translateError } from "@/lib/api-handler"

/**
 * GET /api/expert/me
 * Liefert den Experten-Datensatz des eingeloggten Takumi (liveStatus, lastSeenAt, etc.)
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    const appRole = (session.user as { appRole?: string })?.appRole
    if (appRole !== "takumi") {
      return NextResponse.json({ error: "Nur für Takumi." }, { status: 403 })
    }

    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      select: { id: true, liveStatus: true, lastSeenAt: true, isLive: true },
    })

    if (!expert) {
      return NextResponse.json({ expert: null })
    }

    return NextResponse.json({
      expert: {
        id: expert.id,
        liveStatus: expert.liveStatus ?? "offline",
        lastSeenAt: expert.lastSeenAt?.toISOString() ?? null,
        isLive: expert.isLive,
      },
    })
  } catch (err) {
    return translateError(err)
  }
}

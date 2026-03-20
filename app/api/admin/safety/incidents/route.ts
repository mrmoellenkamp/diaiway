import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/admin/safety/incidents
 * Listet alle Safety-Incidents (KI-Alert-Snapshots) für Admin-Beweissicherung.
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | null
  if (!user?.id || user.role !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }

  try {
    const incidents = await prisma.safetyIncident.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        booking: {
          select: {
            id: true,
            userName: true,
            userEmail: true,
            expertName: true,
            date: true,
            startTime: true,
            status: true,
          },
        },
      },
    })
    return NextResponse.json({ incidents })
  } catch (err) {
    console.error("[Admin Safety Incidents] GET error:", err)
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/admin/safety
 * Listet alle Safety Reports (diaiway Safety Enforcement).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | null
  if (!user?.id || user.role !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }

  try {
    const reports = await prisma.safetyReport.findMany({
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
    const reporterIds = [...new Set(reports.map((r) => r.reporterId))]
    const reportedIds = [...new Set(reports.map((r) => r.reportedId))]
    const userIds = [...new Set([...reporterIds, ...reportedIds])]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, isBanned: true },
    })
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const enriched = reports.map((r) => ({
      ...r,
      reporter: userMap[r.reporterId],
      reported: userMap[r.reportedId],
    }))

    return NextResponse.json({ reports: enriched })
  } catch (err) {
    console.error("[Admin Safety] GET error:", err)
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 })
  }
}

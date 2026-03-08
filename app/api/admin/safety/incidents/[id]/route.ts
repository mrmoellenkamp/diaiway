import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * PATCH /api/admin/safety/incidents/[id]
 * Status setzen: blocked | refunded | resolved
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const user = session?.user as { id?: string; role?: string } | null
  if (!user?.id || user.role !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }

  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const { status: newStatus } = body as { status?: string }

    if (!newStatus || !["pending", "blocked", "refunded", "resolved"].includes(newStatus)) {
      return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 })
    }

    await prisma.safetyIncident.update({
      where: { id },
      data: {
        status: newStatus,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Admin Safety Incidents] PATCH error:", err)
    return NextResponse.json({ error: "Fehler beim Aktualisieren." }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * PATCH /api/admin/safety/[id]
 * Safety Report bearbeiten (status) oder Nutzer sperren (banUserId).
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
    const { status: newStatus, banUserId } = body as { status?: string; banUserId?: string }

    if (banUserId) {
      await prisma.user.update({
        where: { id: banUserId },
        data: { isBanned: true },
      })
    }

    if (newStatus) {
      await prisma.safetyReport.update({
        where: { id },
        data: {
          status: newStatus,
          resolvedBy: user.id,
          resolvedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Admin Safety] PATCH error:", err)
    return NextResponse.json({ error: "Fehler beim Aktualisieren." }, { status: 500 })
  }
}

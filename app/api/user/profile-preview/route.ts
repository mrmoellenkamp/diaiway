import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/user/profile-preview
 * Öffentliche Ansicht des eigenen Profils (wie andere es sehen)
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        image: true,
        createdAt: true,
        skillLevel: true,
      },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    const projects = await prisma.shugyoProject.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, imageUrl: true },
    })

    return NextResponse.json({
      name: user.name,
      image: user.image || "",
      createdAt: user.createdAt,
      skillLevel: user.skillLevel ?? null,
      projects,
    })
  } catch {
    return NextResponse.json({ error: "Fehler." }, { status: 500 })
  }
}

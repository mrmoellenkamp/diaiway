import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/users/[id]
 * Öffentliche Minimal-Infos eines Nutzers (Name, Bild, Mitglied seit).
 * Wenn der Aufrufer Takumi ist: zusätzlich Kenntnisstufe + Shugyo-Projekte des Nutzers.
 * IDs sind CUIDs – ohne Link nicht erratbar.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 })

  try {
    const session = await auth()

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        name: true,
        image: true,
        createdAt: true,
        skillLevel: true,
      },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    const base = {
      name: user.name,
      image: user.image || "",
      createdAt: user.createdAt,
    }

    // Takumi sieht Shugyo-Kenntnisse und Projekte
    const isTakumi =
      session?.user?.id &&
      (await prisma.expert.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      }))

    if (!isTakumi) {
      return NextResponse.json(base)
    }

    const projects = await prisma.shugyoProject.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, imageUrl: true },
    })

    return NextResponse.json({
      ...base,
      skillLevel: user.skillLevel ?? null,
      projects,
    })
  } catch {
    return NextResponse.json({ error: "Fehler." }, { status: 500 })
  }
}

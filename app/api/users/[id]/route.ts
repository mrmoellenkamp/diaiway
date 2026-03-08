import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * GET /api/users/[id]
 * Öffentliche Minimal-Infos eines Nutzers (Name, Bild, Mitglied seit).
 * IDs sind CUIDs – ohne Link nicht erratbar.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 })

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { name: true, image: true, createdAt: true },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    return NextResponse.json({
      name: user.name,
      image: user.image || "",
      createdAt: user.createdAt,
    })
  } catch {
    return NextResponse.json({ error: "Fehler." }, { status: 500 })
  }
}

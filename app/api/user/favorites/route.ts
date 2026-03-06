import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ favorites: [] })

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favorites: true },
    })
    return NextResponse.json({ favorites: user?.favorites || [] })
  } catch {
    return NextResponse.json({ favorites: [] })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const { takumiId } = await req.json()
    if (!takumiId) return NextResponse.json({ error: "takumiId fehlt." }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favorites: true },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    const alreadyFav = user.favorites.includes(takumiId)
    const newFavorites = alreadyFav
      ? user.favorites.filter((id) => id !== takumiId)
      : [...user.favorites, takumiId]

    await prisma.user.update({
      where: { id: session.user.id },
      data: { favorites: newFavorites },
    })

    return NextResponse.json({
      favorites: newFavorites,
      added: !alreadyFav,
      message: !alreadyFav ? "Zu Favoriten hinzugefuegt." : "Aus Favoriten entfernt.",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

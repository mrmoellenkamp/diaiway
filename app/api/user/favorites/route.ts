import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"

const FavSchema = z.object({ takumiId: z.string().min(1).max(100) })

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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "favorites:toggle", limit: 120, windowSec: 600 }
  )
  if (rl) return rl

  try {
    const raw = await req.json()
    const parsed = FavSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "takumiId fehlt." }, { status: 400 })
    }
    const { takumiId } = parsed.data

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favorites: true },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    const alreadyFav = user.favorites.includes(takumiId)
    const newFavorites = alreadyFav
      ? user.favorites.filter((id) => id !== takumiId)
      : [...user.favorites, takumiId]

    // SECURITY: Favoritenliste deckeln, damit Angreifer keine unbegrenzte DB-Blob aufbauen.
    if (newFavorites.length > 500) {
      return NextResponse.json({ error: "Favoriten-Limit erreicht." }, { status: 400 })
    }

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
    logSecureError("user.favorites.POST", err)
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/user/profile-preview
 * Öffentliche Ansicht des eigenen Profils (wie andere es sehen).
 * Liefert Shugyo- und Takumi-Daten; Anzeige erfolgt rollenabhängig im Frontend.
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
        appRole: true,
        skillLevel: true,
      },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    const [shugyoProjects, expert, takumiPortfolio] = await Promise.all([
      prisma.shugyoProject.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, description: true, imageUrl: true },
      }),
      prisma.expert.findUnique({
        where: { userId },
        select: {
          id: true,
          name: true,
          avatar: true,
          categorySlug: true,
          categoryName: true,
          subcategory: true,
          bio: true,
          priceVideo15Min: true,
          priceVoice15Min: true,
          pricePerSession: true,
          responseTime: true,
          imageUrl: true,
          socialLinks: true,
        },
      }),
      prisma.takumiPortfolioProject.findMany({
        where: { userId },
        orderBy: [{ completionDate: "desc" }, { createdAt: "desc" }],
        select: { id: true, title: true, description: true, imageUrl: true, category: true, completionDate: true, createdAt: true },
      }),
    ])

    const shugyo = {
      skillLevel: user.skillLevel ?? null,
      projects: shugyoProjects,
    }

    const takumi = expert
      ? {
          id: expert.id,
          name: expert.name,
          avatar: expert.avatar,
          categoryName: expert.categoryName,
          subcategory: expert.subcategory,
          bio: expert.bio,
          priceVideo15Min: Number(expert.priceVideo15Min),
          priceVoice15Min: Number(expert.priceVoice15Min),
          pricePerSession: expert.pricePerSession,
          responseTime: expert.responseTime,
          imageUrl: expert.imageUrl,
          socialLinks: (expert.socialLinks as Record<string, string>) ?? {},
          portfolio: takumiPortfolio,
        }
      : null

    return NextResponse.json({
      appRole: user.appRole ?? "shugyo",
      name: user.name,
      image: user.image || "",
      createdAt: user.createdAt,
      shugyo,
      takumi,
    })
  } catch {
    return NextResponse.json({ error: "Fehler." }, { status: 500 })
  }
}

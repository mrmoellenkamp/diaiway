import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { communicationUsername } from "@/lib/communication-display"
import { expertPublicBio } from "@/lib/expert-public-bio"
import { translateError } from "@/lib/api-handler"

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
        username: true,
        image: true,
        createdAt: true,
        appRole: true,
        skillLevel: true,
        languages: true,
      },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    const [shugyoProjects, expert, takumiPortfolio, ratedBookings] = await Promise.all([
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
          bioLive: true,
          profileReviewStatus: true,
          profileRejectionReason: true,
          userId: true,
          priceVideo15Min: true,
          priceVoice15Min: true,
          pricePerSession: true,
          responseTime: true,
          imageUrl: true,
          socialLinks: true,
          rating: true,
          reviewCount: true,
          sessionCount: true,
          isPro: true,
          verified: true,
          liveStatus: true,
        },
      }),
      prisma.takumiPortfolioProject.findMany({
        where: { userId },
        orderBy: [{ completionDate: "desc" }, { createdAt: "desc" }],
        select: { id: true, title: true, description: true, imageUrl: true, category: true, completionDate: true, createdAt: true },
      }),
      prisma.booking.findMany({
        where: { userId, expertRating: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          expertRating: true,
          expertReviewText: true,
          updatedAt: true,
          expert: { select: { name: true, avatar: true, user: { select: { username: true, image: true } } } },
        },
      }),
    ])

    const expertReviews = ratedBookings.map((b) => ({
      rating: b.expertRating!,
      text: b.expertReviewText ?? "",
      createdAt: b.updatedAt,
      reviewerName: b.expert?.user?.username ?? b.expert?.name?.split(" ")[0] ?? "Takumi",
      reviewerImage: b.expert?.user?.image ?? "",
      reviewerAvatar: b.expert?.avatar ?? "",
    }))
    const avgRating =
      expertReviews.length > 0
        ? Math.round((expertReviews.reduce((s, r) => s + r.rating, 0) / expertReviews.length) * 10) / 10
        : 0

    const shugyo = {
      skillLevel: user.skillLevel ?? null,
      projects: shugyoProjects,
      avgRating,
      reviewCount: expertReviews.length,
      expertReviews,
    }

    const userDisplayName = communicationUsername(user.username, "Nutzer")
    const publicBio = expert ? expertPublicBio(expert) : ""
    const previewShowsPublicVsPendingHint = expert
      ? expert.profileReviewStatus === "pending_review" &&
        expert.bioLive.trim().length > 0 &&
        expert.bio.trim() !== expert.bioLive.trim()
      : false
    const takumi = expert
      ? {
          id: expert.id,
          name: userDisplayName,
          avatar: expert.avatar,
          categoryName: expert.categoryName,
          subcategory: expert.subcategory,
          bio: publicBio,
          workingBio: expert.bio,
          profileReviewStatus: expert.profileReviewStatus,
          profileRejectionReason: expert.profileRejectionReason,
          previewShowsPublicVsPendingHint,
          priceVideo15Min: Number(expert.priceVideo15Min),
          priceVoice15Min: Number(expert.priceVoice15Min),
          pricePerSession: expert.pricePerSession,
          responseTime: expert.responseTime,
          imageUrl: (expert.imageUrl || user.image || "").trim(),
          socialLinks: (expert.socialLinks as Record<string, string>) ?? {},
          portfolio: takumiPortfolio,
          rating: Number(expert.rating ?? 0),
          reviewCount: expert.reviewCount ?? 0,
          sessionCount: expert.sessionCount ?? 0,
          isPro: expert.isPro ?? false,
          verified: expert.verified ?? false,
          liveStatus: expert.liveStatus ?? "offline",
        }
      : null

    return NextResponse.json({
      appRole: user.appRole ?? "shugyo",
      name: userDisplayName,
      username: (user as { username?: string | null }).username ?? null,
      image: user.image || "",
      createdAt: user.createdAt,
      languages: user.languages ?? [],
      shugyo,
      takumi,
    })
  } catch (err) {
    console.error("[api/user/profile-preview]", err)
    return translateError(err)
  }
}

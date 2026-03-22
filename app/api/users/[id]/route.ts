import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { communicationUsername } from "@/lib/communication-display"

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
        username: true,
        image: true,
        createdAt: true,
        skillLevel: true,
      },
    })
    if (!user) return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })

    const displayName = communicationUsername(user.username, "Nutzer")
    const base = {
      name: displayName,
      image: user.image || "",
      createdAt: user.createdAt,
    }

    // Bewertungen durch Takumis (expertRating an Bookings)
    const ratedBookings = await prisma.booking.findMany({
      where: { userId: id, expertRating: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        expertRating: true,
        expertReviewText: true,
        updatedAt: true,
        expert: { select: { name: true, avatar: true, user: { select: { username: true, image: true } } } },
      },
    })

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

    // Takumi sieht zusätzlich Kenntnisstufe + Shugyo-Projekte
    const isTakumi =
      session?.user?.id &&
      (await prisma.expert.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      }))

    if (!isTakumi) {
      return NextResponse.json({ ...base, avgRating, reviewCount: expertReviews.length, expertReviews })
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
      avgRating,
      reviewCount: expertReviews.length,
      expertReviews,
    })
  } catch {
    return NextResponse.json({ error: "Fehler." }, { status: 500 })
  }
}

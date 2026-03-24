import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/admin/users/[id]/ratings
 * Alle bewertungsrelevanten Daten für einen Nutzer (abgegeben, erhalten als Shugyo, erhalten als Takumi).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      appRole: true,
      expert: { select: { id: true, name: true } },
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })
  }

  const [writtenReviews, completedBookingsAsBooker, receivedReviews] = await Promise.all([
    prisma.review.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        expertId: true,
        userId: true,
        bookingId: true,
        rating: true,
        text: true,
        createdAt: true,
        expert: { select: { id: true, name: true } },
      },
    }),
    prisma.booking.findMany({
      where: { userId: id, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        date: true,
        startTime: true,
        expertId: true,
        expertName: true,
        status: true,
        expertRating: true,
        expertReviewText: true,
        createdAt: true,
      },
    }),
    user.expert
      ? prisma.review.findMany({
          where: { expertId: user.expert.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            expertId: true,
            userId: true,
            bookingId: true,
            rating: true,
            text: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ])

  const reviewerIds = [...new Set(receivedReviews.map((r) => r.userId))]
  const reviewers =
    reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, name: true, email: true },
        })
      : []
  const reviewerMap = new Map(reviewers.map((u) => [u.id, u]))

  const receivedWithReviewer = receivedReviews.map((r) => ({
    ...r,
    reviewer: reviewerMap.get(r.userId) ?? { id: r.userId, name: "—", email: "" },
  }))

  return NextResponse.json({
    user,
    writtenReviews,
    completedBookingsAsBooker,
    receivedReviewsAsExpert: receivedWithReviewer,
  })
}

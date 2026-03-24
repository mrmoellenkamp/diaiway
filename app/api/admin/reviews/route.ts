import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recomputeExpertReviewAggregate } from "@/lib/recompute-expert-review-aggregate"

export const runtime = "nodejs"

/**
 * POST /api/admin/reviews
 * Manuelle öffentliche Review (Shugyo → Takumi), optional mit bookingId.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { userId, expertId, rating, text, bookingId } = body as {
    userId?: unknown
    expertId?: unknown
    rating?: unknown
    text?: unknown
    bookingId?: unknown
  }

  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId fehlt." }, { status: 400 })
  }
  if (typeof expertId !== "string" || !expertId.trim()) {
    return NextResponse.json({ error: "expertId fehlt." }, { status: 400 })
  }

  const r = Math.min(5, Math.max(1, Number(rating) || 0))
  if (r < 1) {
    return NextResponse.json({ error: "Bewertung muss zwischen 1 und 5 liegen." }, { status: 400 })
  }

  const [expert, user] = await Promise.all([
    prisma.expert.findUnique({ where: { id: expertId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ])

  if (!expert) {
    return NextResponse.json({ error: "Takumi nicht gefunden." }, { status: 404 })
  }
  if (!user) {
    return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })
  }
  if (expert.userId && expert.userId === userId) {
    return NextResponse.json(
      { error: "Reviewer und Takumi dürfen nicht dieselbe Person sein." },
      { status: 400 }
    )
  }

  let bookingIdNorm: string | null = null
  if (bookingId != null && bookingId !== "") {
    if (typeof bookingId !== "string") {
      return NextResponse.json({ error: "bookingId ungültig." }, { status: 400 })
    }
    bookingIdNorm = bookingId
    const booking = await prisma.booking.findUnique({ where: { id: bookingIdNorm } })
    if (!booking) {
      return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
    }
    if (booking.userId !== userId || booking.expertId !== expertId) {
      return NextResponse.json(
        { error: "Buchung passt nicht zu Nutzer und Takumi." },
        { status: 400 }
      )
    }
    const existing = await prisma.review.findUnique({ where: { bookingId: bookingIdNorm } })
    if (existing) {
      return NextResponse.json(
        { error: "Für diese Buchung existiert bereits eine Review." },
        { status: 400 }
      )
    }
  }

  const textNorm = typeof text === "string" ? text.trim().slice(0, 2000) : ""

  const created = await prisma.review.create({
    data: {
      expertId,
      userId,
      bookingId: bookingIdNorm,
      rating: r,
      text: textNorm,
    },
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

  await recomputeExpertReviewAggregate(expertId)

  return NextResponse.json({ review: created })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recomputeExpertReviewAggregate } from "@/lib/recompute-expert-review-aggregate"

export const runtime = "nodejs"

/**
 * PATCH /api/admin/reviews/[reviewId]
 * Text und Sterne einer öffentlichen Review (Shugyo bewertet Takumi) anpassen.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { reviewId } = await params
  const body = await req.json().catch(() => ({}))
  const { rating, text } = body as { rating?: unknown; text?: unknown }

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, expertId: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Review nicht gefunden." }, { status: 404 })
  }

  const data: { rating?: number; text?: string } = {}
  if (rating !== undefined) {
    const r = Math.min(5, Math.max(1, Number(rating) || 0))
    if (r < 1) {
      return NextResponse.json({ error: "Bewertung muss zwischen 1 und 5 liegen." }, { status: 400 })
    }
    data.rating = r
  }
  if (text !== undefined) {
    data.text = typeof text === "string" ? text.trim().slice(0, 2000) : ""
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 })
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data,
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

  await recomputeExpertReviewAggregate(existing.expertId)

  return NextResponse.json({ review: updated })
}

/**
 * DELETE /api/admin/reviews/[reviewId]
 * Öffentliche Review entfernen; Experten-Sterne werden neu berechnet.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { reviewId } = await params

  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, expertId: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Review nicht gefunden." }, { status: 404 })
  }

  await prisma.review.delete({ where: { id: reviewId } })
  await recomputeExpertReviewAggregate(existing.expertId)

  return NextResponse.json({ ok: true })
}

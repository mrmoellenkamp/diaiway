import { prisma } from "@/lib/db"

/** Aktualisiert Expert.rating und reviewCount aus allen Review-Einträgen. */
export async function recomputeExpertReviewAggregate(expertId: string): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { expertId },
    select: { rating: true },
  })
  const n = reviews.length
  const avg = n === 0 ? 0 : reviews.reduce((s, x) => s + x.rating, 0) / n
  await prisma.expert.update({
    where: { id: expertId },
    data: {
      rating: Math.round(avg * 10) / 10,
      reviewCount: n,
    },
  })
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/** GET /api/reviews?expertId=xxx — public review list for a Takumi profile */
export async function GET(req: NextRequest) {
  try {
    const expertId = req.nextUrl.searchParams.get("expertId")
    if (!expertId) {
      return NextResponse.json({ error: "expertId fehlt." }, { status: 400 })
    }

    const reviews = await prisma.review.findMany({
      where: { expertId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        text: true,
        createdAt: true,
        userId: true,
      },
    })

    const userIds = [...new Set(reviews.map((r) => r.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, name: true, image: true },
    })
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    return NextResponse.json({
      reviews: reviews.map((r) => {
        const u = userMap[r.userId]
        return {
          id: r.id,
          rating: r.rating,
          text: r.text,
          createdAt: r.createdAt,
          reviewerName: u?.username ?? u?.name?.split(" ")[0] ?? "Anonym",
          reviewerImage: u?.image ?? "",
        }
      }),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const q = searchParams.get("q") || ""
  const appRole = searchParams.get("appRole") || undefined
  const page = Math.max(1, Number(searchParams.get("page") || "1"))
  const limitRaw = Number(searchParams.get("limit") || "20")
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20))

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { username: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(appRole ? { appRole: appRole as "shugyo" | "takumi" } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        appRole: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { bookings: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const userIds = users.map((u) => u.id)
  const [writtenGroups, expertsWithReviewCount] = await Promise.all([
    userIds.length
      ? prisma.review.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.expert.findMany({
          where: { userId: { in: userIds } },
          select: {
            userId: true,
            _count: { select: { reviews: true } },
          },
        })
      : Promise.resolve([]),
  ])

  const writtenMap = new Map(writtenGroups.map((g) => [g.userId, g._count._all]))
  const receivedMap = new Map(
    expertsWithReviewCount
      .filter((e): e is typeof e & { userId: string } => e.userId != null)
      .map((e) => [e.userId, e._count.reviews])
  )

  const usersWithReviews = users.map((u) => ({
    ...u,
    reviewCounts: {
      written: writtenMap.get(u.id) ?? 0,
      received: receivedMap.get(u.id) ?? 0,
    },
  }))

  return NextResponse.json({ users: usersWithReviews, total, page, limit })
}

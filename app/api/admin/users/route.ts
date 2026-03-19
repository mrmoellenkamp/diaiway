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
  const limit = 20

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
        customerNumber: true,
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

  return NextResponse.json({ users, total, page, limit })
}

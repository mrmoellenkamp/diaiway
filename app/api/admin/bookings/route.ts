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
  const status = searchParams.get("status") || undefined
  const page = Math.max(1, Number(searchParams.get("page") || "1"))
  const limit = 20

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { userName: { contains: q, mode: "insensitive" as const } },
            { expertName: { contains: q, mode: "insensitive" as const } },
            { userEmail: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userName: true,
        userEmail: true,
        expertName: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        price: true,
        paymentStatus: true,
        paidAmount: true,
        stripePaymentIntentId: true,
        cancelledBy: true,
        cancelFeeAmount: true,
        cancelledAt: true,
        createdAt: true,
      },
    }),
    prisma.booking.count({ where }),
  ])

  return NextResponse.json({ bookings, total, page, limit })
}

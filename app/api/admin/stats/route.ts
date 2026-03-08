import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Sync: Nutzer mit appRole=takumi müssen einen Expert haben (konsistente Anzeige)
  const takumiUsersToSync = await prisma.user.findMany({
    where: { appRole: "takumi" },
    select: { id: true, name: true, email: true },
  })
  for (const u of takumiUsersToSync) {
    const existing = await prisma.expert.findUnique({ where: { userId: u.id } })
    if (!existing) {
      await prisma.expert.create({
        data: {
          userId: u.id,
          name: u.name,
          avatar: (u.name && u.name.charAt(0).toUpperCase()) || "T",
          email: u.email ?? "",
          categorySlug: "dienstleistungen",
          categoryName: "Dienstleistungen",
          subcategory: "",
          bio: "",
          priceVideo15Min: 1,
          priceVoice15Min: 1,
          pricePerSession: 0,
          rating: 0,
          reviewCount: 0,
          sessionCount: 0,
          isLive: false,
          isPro: false,
          verified: false,
          portfolio: [],
          joinedDate: new Date().toISOString().slice(0, 10),
          matchRate: 0,
        },
      })
    }
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    shugyoUsers,
    takumiUsers,
    newUsersThisMonth,
    newUsersLast30Days,
    totalExperts,
    liveExperts,
    verifiedExperts,
    totalBookings,
    bookingsByStatus,
    bookingsThisMonth,
    bookingsLast7Days,
    paidBookings,
    paidThisMonth,
    paidLastMonth,
    recentBookings,
    recentUsers,
    topExperts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { appRole: "shugyo" } }),
    prisma.user.count({ where: { appRole: "takumi" } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOf30Days } } }),
    prisma.expert.count(),
    prisma.expert.count({ where: { isLive: true } }),
    prisma.expert.count({ where: { verified: true } }),
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ["status"], _count: true }),
    prisma.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.booking.count({ where: { createdAt: { gte: startOf7Days } } }),
    prisma.booking.aggregate({
      where: { paymentStatus: "paid" },
      _sum: { paidAmount: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { paymentStatus: "paid", paidAt: { gte: startOfMonth } },
      _sum: { paidAmount: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { paymentStatus: "paid", paidAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { paidAmount: true },
      _count: true,
    }),
    prisma.booking.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userName: true,
        expertName: true,
        date: true,
        startTime: true,
        status: true,
        price: true,
        paymentStatus: true,
        createdAt: true,
        cancelledBy: true,
      },
    }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        appRole: true,
        createdAt: true,
      },
    }),
    prisma.expert.findMany({
      take: 5,
      orderBy: { sessionCount: "desc" },
      select: {
        id: true,
        name: true,
        categoryName: true,
        rating: true,
        sessionCount: true,
        reviewCount: true,
        isLive: true,
        pricePerSession: true,
      },
    }),
  ])

  const statusMap: Record<string, number> = {}
  for (const row of bookingsByStatus) {
    statusMap[row.status] = row._count
  }

  const totalRevenueCents = paidBookings._sum.paidAmount ?? 0
  const revenueThisMonthCents = paidThisMonth._sum.paidAmount ?? 0
  const revenueLastMonthCents = paidLastMonth._sum.paidAmount ?? 0
  const revGrowthPct =
    revenueLastMonthCents > 0
      ? Math.round(((revenueThisMonthCents - revenueLastMonthCents) / revenueLastMonthCents) * 100)
      : revenueThisMonthCents > 0
        ? 100
        : 0

  return NextResponse.json({
    users: {
      total: totalUsers,
      shugyo: shugyoUsers,
      takumi: takumiUsers,
      newThisMonth: newUsersThisMonth,
      newLast30Days: newUsersLast30Days,
    },
    experts: {
      total: totalExperts,
      live: liveExperts,
      verified: verifiedExperts,
    },
    bookings: {
      total: totalBookings,
      thisMonth: bookingsThisMonth,
      last7Days: bookingsLast7Days,
      byStatus: statusMap,
    },
    revenue: {
      totalCents: totalRevenueCents,
      thisMonthCents: revenueThisMonthCents,
      lastMonthCents: revenueLastMonthCents,
      growthPct: revGrowthPct,
      paidCount: paidBookings._count,
      paidThisMonthCount: paidThisMonth._count,
    },
    recent: {
      bookings: recentBookings,
      users: recentUsers,
    },
    topExperts,
  })
}

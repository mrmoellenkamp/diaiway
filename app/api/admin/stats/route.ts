import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { runBookingListHousekeeping } from "@/lib/booking-housekeeping"

export const maxDuration = 60

const ADMIN_STATS_BOOKING_SELECT = {
  id: true,
  userId: true,
  expertId: true,
  userName: true,
  expertName: true,
  date: true,
  startTime: true,
  status: true,
  price: true,
  paymentStatus: true,
  createdAt: true,
  cancelledBy: true,
} satisfies Prisma.BookingSelect

const ADMIN_STATS_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  appRole: true,
  createdAt: true,
} satisfies Prisma.UserSelect

const ADMIN_STATS_EXPERT_SELECT = {
  id: true,
  name: true,
  categoryName: true,
  rating: true,
  sessionCount: true,
  reviewCount: true,
  isLive: true,
  pricePerSession: true,
} satisfies Prisma.ExpertSelect

type AdminStatsRecentBooking = Prisma.BookingGetPayload<{ select: typeof ADMIN_STATS_BOOKING_SELECT }>
type AdminStatsRecentUser = Prisma.UserGetPayload<{ select: typeof ADMIN_STATS_USER_SELECT }>
type AdminStatsTopExpert = Prisma.ExpertGetPayload<{ select: typeof ADMIN_STATS_EXPERT_SELECT }>

/** Fallback wenn DB-Schema fehlt oder Aggregationen fehlschlagen — UI bleibt bedienbar. */
function emptyStatsPayload(degradedReason: string) {
  return {
    users: { total: 0, shugyo: 0, takumi: 0, newThisMonth: 0, newLast30Days: 0 },
    experts: { total: 0, live: 0, verified: 0 },
    bookings: { total: 0, thisMonth: 0, last7Days: 0, byStatus: {} as Record<string, number> },
    revenue: {
      totalCents: 0,
      thisMonthCents: 0,
      lastMonthCents: 0,
      growthPct: 0,
      paidCount: 0,
      paidThisMonthCount: 0,
    },
    recent: { bookings: [], users: [] },
    topExperts: [],
    degraded: true as const,
    degradedReason,
  }
}

/** Sync: Nutzer mit appRole=takumi müssen einen Expert haben — darf Stats nicht killen. */
async function syncTakumiExpertsWithUsers(): Promise<void> {
  try {
    const takumiUsersToSync = await prisma.user.findMany({
      where: { appRole: "takumi" },
      select: { id: true, name: true, email: true },
    })
    for (const u of takumiUsersToSync) {
      const existing = await prisma.expert.findUnique({ where: { userId: u.id } })
      if (!existing) {
        const expertByEmail = u.email
          ? await prisma.expert.findFirst({
              where: {
                userId: null,
                email: { equals: u.email, mode: "insensitive" },
              },
            })
          : null
        if (expertByEmail) {
          await prisma.expert.update({
            where: { id: expertByEmail.id },
            data: { userId: u.id, email: u.email ?? expertByEmail.email },
          })
        } else {
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
    }
  } catch (err) {
    console.error("[admin/stats] Takumi-Expert-Sync übersprungen:", err)
  }
}

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // JWT kann kurz hinter der DB liegen — primär Rolle aus DB; bei DB-Ausfall JWT (wie Admin-Layout Cold Start)
  let isAdmin = false
  try {
    const row = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    isAdmin = row?.role === "admin"
  } catch {
    isAdmin = (session.user as { role?: string }).role === "admin"
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  void runBookingListHousekeeping().catch(() => {})

  await syncTakumiExpertsWithUsers()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  let totalUsers: number
  let shugyoUsers: number
  let takumiUsers: number
  let newUsersThisMonth: number
  let newUsersLast30Days: number
  let totalExperts: number
  let liveExperts: number
  let verifiedExperts: number
  let totalBookings: number
  let bookingsByStatus: { status: string; _count: number }[]
  let bookingsThisMonth: number
  let bookingsLast7Days: number
  let paidBookings: { _sum: { paidAmount: number | null }; _count: number }
  let paidThisMonth: { _sum: { paidAmount: number | null }; _count: number }
  let paidLastMonth: { _sum: { paidAmount: number | null }; _count: number }
  let recentBookings: AdminStatsRecentBooking[]
  let recentUsers: AdminStatsRecentUser[]
  let topExperts: AdminStatsTopExpert[]

  try {
    ;[
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
      select: ADMIN_STATS_BOOKING_SELECT,
    }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: ADMIN_STATS_USER_SELECT,
    }),
    prisma.expert.findMany({
      take: 5,
      orderBy: { sessionCount: "desc" },
      select: ADMIN_STATS_EXPERT_SELECT,
    }),
    ])
  } catch (err: unknown) {
    console.error("[admin/stats] Aggregation fehlgeschlagen:", err)
    const msg = err instanceof Error ? err.message : String(err)
    const short = msg.length > 220 ? `${msg.slice(0, 220)}…` : msg
    const isSchema =
      /does not exist|relation|Unknown column|column|migration|P20[0-9]{2}/i.test(msg)
    const hint = isSchema
      ? `Datenbank-Schema passt nicht zum Code (${short}). Auf dem Server \`npm run db:migrate:deploy\` ausführen.`
      : `Statistik-Abfragen fehlgeschlagen: ${short}`
    return NextResponse.json(emptyStatsPayload(hint))
  }

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
    degraded: false,
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

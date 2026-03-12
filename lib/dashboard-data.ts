/**
 * Server-side dashboard data for Shugyo & Takumi.
 * Used by app/(app)/dashboard/page.tsx (Server Component).
 */
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getTakumiWallet } from "@/lib/wallet-service"

const ONLINE_MS = 30 * 1000 // 30 s

export interface DashboardBooking {
  id: string
  expertId: string
  expertName: string
  takumiAvatar?: string
  takumiSubcategory?: string
  userId: string
  userName: string
  date: string
  startTime: string
  endTime: string
  status: string
  totalPrice?: number
  price?: number
  statusToken: string
  createdAt: Date
}

export interface DashboardThread {
  partnerId: string
  partnerName: string
  partnerAvatar: string
  subcategory: string
  expertId: string | null
  isOnline: boolean
  lastMessage: { text: string; sender: string; timestamp: number } | null
  unread: number
}

export interface FavoriteOnline {
  id: string
  name: string
  avatar: string
  subcategory: string
  categorySlug: string
  imageUrl?: string
}

export interface DashboardData {
  userName: string
  appRole: "shugyo" | "takumi"
  // Shugyo: eigene Käufe (userId = current)
  shugyoBookings: DashboardBooking[]
  // Takumi: eigene Verkäufe (expertId = user's expert)
  takumiBookings: DashboardBooking[]
  // Next sessions (confirmed + future date) — für Shugyo die nächsten Käufe, für Takumi die nächsten Verkäufe
  nextSessions: DashboardBooking[]
  // Pending (nur für Takumi)
  pendingBookings: DashboardBooking[]
  threads: DashboardThread[]
  favoritesOnline: FavoriteOnline[]
  wallet: { balance: number; pendingBalance: number; canWithdraw: boolean } | null
  projectCount: number
  earningsCents: number
}

export async function getDashboardData(): Promise<DashboardData | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const userId = session.user.id
  const appRole = ((session.user as { appRole?: string }).appRole || "shugyo") as "shugyo" | "takumi"
  const userName = session.user.name ?? ""

  const [userExpert, userProfile] = await Promise.all([
    prisma.expert.findUnique({ where: { userId }, select: { id: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { favorites: true, balance: true, pendingBalance: true },
    }),
  ])

  const favorites = userProfile?.favorites ?? []

  // Bookings: Shugyo = Käufe (userId), Takumi = Verkäufe (expertId)
  const [shugyoBookingsRaw, takumiBookingsRaw, threadsData, expertsAll, wallet, projectCount, earningsAgg] =
    await Promise.all([
      prisma.booking.findMany({
        where: { userId },
        include: { expert: { select: { avatar: true, subcategory: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      userExpert
        ? prisma.booking.findMany({
            where: { expertId: userExpert.id },
            include: { expert: { select: { avatar: true, subcategory: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : [],
      getChatThreads(userId),
      favorites.length > 0
        ? prisma.expert.findMany({
            where: { id: { in: favorites } },
            select: {
              id: true,
              name: true,
              avatar: true,
              subcategory: true,
              categorySlug: true,
              imageUrl: true,
              isLive: true,
              lastSeenAt: true,
            },
          })
        : [],
      getTakumiWallet(userId),
      prisma.shugyoProject.count({ where: { userId } }),
      userExpert
        ? prisma.transaction.aggregate({
            where: { expertId: userExpert.id, status: "CAPTURED" },
            _sum: { netPayout: true },
          })
        : null,
    ])

  const mapBooking = (b: (typeof shugyoBookingsRaw)[0]): DashboardBooking => ({
    id: b.id,
    expertId: b.expertId,
    expertName: b.expertName,
    takumiAvatar: b.expert?.avatar ?? undefined,
    takumiSubcategory: b.expert?.subcategory ?? undefined,
    userId: b.userId,
    userName: b.userName,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    totalPrice: b.totalPrice != null ? Number(b.totalPrice) : undefined,
    price: b.price ?? undefined,
    statusToken: b.statusToken,
    createdAt: b.createdAt,
  })

  const shugyoBookings = shugyoBookingsRaw.map(mapBooking)
  const takumiBookings = takumiBookingsRaw.map(mapBooking)

  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  const nextSessions =
    appRole === "shugyo"
      ? shugyoBookings.filter(
          (b) =>
            (b.status === "confirmed" || b.status === "active") &&
            (b.date > today || (b.date === today && b.startTime >= new Date().toTimeString().slice(0, 5)))
        )
      : takumiBookings.filter(
          (b) =>
            (b.status === "confirmed" || b.status === "active") &&
            (b.date > today || (b.date === today && b.startTime >= new Date().toTimeString().slice(0, 5)))
        )

  nextSessions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.startTime.localeCompare(b.startTime)
  })

  const pendingBookings = takumiBookings.filter((b) => b.status === "pending")

  const favorites = userProfile?.favorites ?? []
  const nowTs = Date.now()
  const favoritesOnline: FavoriteOnline[] = expertsAll
    .filter(
      (e) =>
        favorites.includes(e.id) &&
        e.isLive &&
        e.lastSeenAt != null &&
        nowTs - e.lastSeenAt.getTime() < ONLINE_MS
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      avatar: e.avatar,
      subcategory: e.subcategory,
      categorySlug: e.categorySlug,
      imageUrl: e.imageUrl ?? undefined,
    }))

  const earningsCents = earningsAgg?._sum?.netPayout ?? 0

  return {
    userName,
    appRole,
    shugyoBookings,
    takumiBookings,
    nextSessions: nextSessions.slice(0, 5),
    pendingBookings: pendingBookings.slice(0, 10),
    threads: threadsData,
    favoritesOnline,
    wallet: wallet ?? { balance: userProfile?.balance ?? 0, pendingBalance: userProfile?.pendingBalance ?? 0, canWithdraw: false },
    projectCount,
    earningsCents,
  }
}

async function getChatThreads(userId: string): Promise<DashboardThread[]> {
  const sent = await prisma.directMessage.findMany({
    where: { senderId: userId, communicationType: "CHAT" },
    select: { recipientId: true },
    distinct: ["recipientId"],
  })
  const received = await prisma.directMessage.findMany({
    where: { recipientId: userId, communicationType: "CHAT", senderId: { not: null } },
    select: { senderId: true },
    distinct: ["senderId"],
  })
  const partnerIds = [
    ...new Set([
      ...sent.map((s) => s.recipientId),
      ...received.map((r) => r.senderId!).filter(Boolean),
    ]),
  ].filter((id): id is string => id != null && id !== userId)

  const threads = await Promise.all(
    partnerIds.map(async (partnerId) => {
      const user = await prisma.user.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true, image: true },
      })
      const expert = await prisma.expert.findFirst({
        where: { userId: partnerId },
        select: { id: true, avatar: true, imageUrl: true, subcategory: true, isLive: true, lastSeenAt: true },
      })
      const lastMsg = await prisma.directMessage.findFirst({
        where: {
          communicationType: "CHAT",
          OR: [
            { senderId: userId, recipientId: partnerId },
            { senderId: partnerId, recipientId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
      })
      const unread = await prisma.directMessage.count({
        where: { recipientId: userId, senderId: partnerId, read: false, communicationType: "CHAT" },
      })
      const displayName = user?.name ?? "Nutzer"
      const avatar = expert?.avatar ?? (displayName.slice(0, 2).toUpperCase() || "?")
      const lastSeen = expert?.lastSeenAt?.getTime()
      const isOnline = expert?.isLive === true && lastSeen != null && Date.now() - lastSeen < ONLINE_MS

      return {
        partnerId,
        partnerName: displayName,
        partnerAvatar: avatar,
        subcategory: expert?.subcategory ?? "",
        expertId: expert?.id ?? null,
        isOnline: !!isOnline,
        lastMessage: lastMsg
          ? {
              text: lastMsg.text,
              sender: lastMsg.senderId === userId ? "user" : "partner",
              timestamp: lastMsg.createdAt.getTime(),
            }
          : null,
        unread,
      }
    })
  )

  threads.sort((a, b) => {
    const aTime = a.lastMessage?.timestamp ?? 0
    const bTime = b.lastMessage?.timestamp ?? 0
    return bTime - aTime
  })

  return threads.slice(0, 5)
}

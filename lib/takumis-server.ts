/**
 * Server-seitige Takumi-Abfrage für ISR/Static Generation.
 * Gleiche Logik wie GET /api/takumis, ohne HTTP-Overhead.
 */
import { prisma } from "@/lib/db"
import type { CancelPolicy, Takumi } from "@/lib/types"

export async function getTakumisForServer(): Promise<Takumi[]> {
  let experts: Awaited<ReturnType<typeof prisma.expert.findMany>>
  try {
    experts = await prisma.expert.findMany({
      include: { user: { select: { appRole: true, isVerified: true, emailConfirmedAt: true } } },
      orderBy: { rating: "desc" },
    })
  } catch (colErr: unknown) {
    if ((colErr as { code?: string })?.code === "P2022") {
      experts = await prisma.expert.findMany({
        include: { user: { select: { appRole: true, isVerified: true } } },
        orderBy: { rating: "desc" },
      })
    } else throw colErr
  }
  const hasEmailCheck = experts[0]?.user && "emailConfirmedAt" in experts[0].user
  const active = experts.filter((e) => {
    if (!e.userId) return true
    const u = e.user
    if (!u || u.appRole !== "takumi") return false
    return hasEmailCheck ? !!(u as { emailConfirmedAt?: Date }).emailConfirmedAt : true
  })

  const now = Date.now()
  const ONLINE_MS = 30 * 1000

  return active.map((e) => {
    const lastSeen = e.lastSeenAt?.getTime()
    const isActuallyOnline = lastSeen != null && now - lastSeen < ONLINE_MS
    const isLive = e.isLive && isActuallyOnline
    return {
      id: e.id,
      name: e.name,
      email: e.email ?? undefined,
      avatar: e.avatar,
      categorySlug: e.categorySlug,
      categoryName: e.categoryName,
      subcategory: e.subcategory,
      bio: e.bio,
      rating: e.rating,
      reviewCount: e.reviewCount,
      sessionCount: e.sessionCount,
      responseTime: e.responseTime,
      priceVideo15Min: Number(e.priceVideo15Min ?? (e.pricePerSession ? e.pricePerSession / 2 : 0)),
      priceVoice15Min: Number(e.priceVoice15Min ?? (e.pricePerSession ? e.pricePerSession / 2 : 0)),
      pricePerSession: e.pricePerSession ?? undefined,
      isLive,
      liveStatus: e.liveStatus ?? null,
      pricePerMinute: Math.round((Number(e.priceVideo15Min ?? (e.pricePerSession ? e.pricePerSession / 2 : 0)) * 100 / 15)),
      isPro: e.isPro,
      verified: e.verified || (e.user?.isVerified ?? false),
      portfolio: e.portfolio,
      joinedDate: e.joinedDate,
      imageUrl: e.imageUrl ?? undefined,
      socialLinks: (e.socialLinks ?? {}) as Takumi["socialLinks"],
      cancelPolicy: (e.cancelPolicy as unknown as CancelPolicy) ?? { freeHours: 24, feePercent: 0 },
    }
  })
}

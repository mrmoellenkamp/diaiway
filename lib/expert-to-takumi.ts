import type { Expert, TaxonomyCategory, TaxonomySpecialty } from "@prisma/client"
import type { CancelPolicy, Takumi } from "@/lib/types"

/** Fenster für „in der App / online“ (muss zu Heartbeat-Intervall passen, s. useTakumiPresence). */
export const TAKUMI_ONLINE_PRESENCE_MS = 30 * 1000

type ExpertWithTaxonomy = Expert & {
  user: { appRole: string; isVerified: boolean; username: string | null; image: string | null } | null
  categoryAssignments: { category: Pick<TaxonomyCategory, "slug" | "name"> }[]
  specialtyAssignments: { specialty: Pick<TaxonomySpecialty, "name"> }[]
  primaryCategory: Pick<TaxonomyCategory, "slug" | "name"> | null
  primarySpecialty: Pick<TaxonomySpecialty, "name"> | null
}

export function expertRowToTakumi(e: ExpertWithTaxonomy): Takumi {
  const now = Date.now()
  const lastSeen = e.lastSeenAt?.getTime()
  const isActuallyOnline = lastSeen != null && now - lastSeen < TAKUMI_ONLINE_PRESENCE_MS
  const isLive = isActuallyOnline && !(e.hideOnlineStatus ?? false)

  const assignSlugs = e.categoryAssignments.map((a) => a.category.slug)
  const categorySlugs = [...new Set([...assignSlugs, e.categorySlug].filter(Boolean))]

  const categorySlug = e.primaryCategory?.slug ?? e.categorySlug
  const categoryName = e.primaryCategory?.name ?? e.categoryName
  const subcategory = e.primarySpecialty?.name ?? e.subcategory

  const specNames = e.specialtyAssignments.map((a) => a.specialty.name)
  const allSpecialties = [...new Set([subcategory, ...specNames].filter(Boolean))]
  const u = e.user?.username?.trim()
  const taxonomySearchText = [
    e.name,
    u ?? "",
    categoryName,
    subcategory,
    ...specNames,
    e.bio,
    ...categorySlugs,
  ]
    .join(" ")
    .toLowerCase()

  return {
    id: e.id,
    name: e.name,
    username: e.user?.username ?? null,
    email: e.email ?? undefined,
    avatar: e.avatar,
    categorySlug,
    categorySlugs: categorySlugs.length > 0 ? categorySlugs : [categorySlug].filter(Boolean),
    categoryName,
    subcategory,
    allSpecialties,
    taxonomySearchText,
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
    pricePerMinute: Math.round(
      (Number(e.priceVideo15Min ?? (e.pricePerSession ? e.pricePerSession / 2 : 0)) * 100) / 15,
    ),
    isPro: e.isPro,
    verified: e.verified || (e.user?.isVerified ?? false),
    portfolio: e.portfolio,
    joinedDate: e.joinedDate,
    imageUrl: (e.imageUrl || e.user?.image || "").trim() || undefined,
    socialLinks: (e.socialLinks ?? {}) as Takumi["socialLinks"],
    cancelPolicy: (e.cancelPolicy as unknown as CancelPolicy) ?? { freeHours: 24, feePercent: 0 },
  }
}

export const expertTaxonomyInclude = {
  user: { select: { appRole: true, isVerified: true, username: true, image: true } },
  categoryAssignments: {
    include: { category: { select: { slug: true, name: true } } },
  },
  specialtyAssignments: {
    include: { specialty: { select: { name: true } } },
  },
  primaryCategory: { select: { slug: true, name: true } },
  primarySpecialty: { select: { name: true } },
} as const

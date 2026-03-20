import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { seedTakumis } from "@/lib/seed-data"

export const runtime = "nodejs"

function emailForName(name: string): string {
  const local = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")
  return `${local || "expert"}@diaiway.test`
}

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed in Production deaktiviert." }, { status: 404 })
  }
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json(
      { error: "Nicht autorisiert. Nur Admins koennen die Datenbank seeden." },
      { status: 401 }
    )
  }

  try {
    // Clear existing experts (reviews + bookings referencing them should be cleared first)
    await prisma.review.deleteMany()
    await prisma.booking.deleteMany()
    await prisma.expert.deleteMany({ where: { userId: null } }) // only seed experts, not linked ones

    const seedData = seedTakumis.map((t) => ({
      name: t.name,
      email: emailForName(t.name),
      avatar: t.avatar,
      categorySlug: t.categorySlug,
      categoryName: t.categoryName,
      subcategory: t.subcategory,
      bio: t.bio,
      rating: t.rating,
      reviewCount: t.reviewCount,
      sessionCount: t.sessionCount,
      responseTime: t.responseTime,
      priceVideo15Min: t.pricePerSession / 2,
      priceVoice15Min: t.pricePerSession / 2,
      pricePerSession: t.pricePerSession,
      isLive: t.isLive,
      isPro: t.isPro,
      verified: t.verified,
      portfolio: t.portfolio,
      joinedDate: t.joinedDate,
      imageUrl: "",
      matchRate: Math.floor(Math.random() * 20) + 80,
    }))

    await prisma.expert.createMany({ data: seedData })

    const { ensureTaxonomySeeded, backfillExpertTaxonomyFromLegacy } = await import("@/lib/taxonomy-server")
    await ensureTaxonomySeeded()
    await backfillExpertTaxonomyFromLegacy()

    return NextResponse.json({
      success: true,
      message: `${seedData.length} Experten erfolgreich in die Datenbank geschrieben.`,
      count: seedData.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Seed-Fehler"
    console.error("[diAiway] POST /api/takumis/seed error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

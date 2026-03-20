import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { emailForName } from "@/lib/email-utils"
import { requireAdmin } from "@/lib/api-auth"
import { ensureTaxonomySeeded } from "@/lib/taxonomy-server"
import { expertRowToTakumi, expertTaxonomyInclude } from "@/lib/expert-to-takumi"

export const runtime = "nodejs"

export async function GET() {
  try {
    await ensureTaxonomySeeded()
    const experts = await prisma.expert.findMany({
      include: expertTaxonomyInclude,
      orderBy: [{ isLive: "desc" }, { lastSeenAt: "desc" }, { rating: "desc" }],
    })
    const active = experts.filter((e) => {
      if (!e.userId) return true
      const u = e.user
      return u && u.appRole === "takumi"
    })

    const payload = active.map((e) => ({
      ...expertRowToTakumi(e),
      email: e.email,
      matchRate: e.matchRate,
    }))

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DB-Fehler"
    console.error("[diAiway] GET /api/takumis error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

/** POST — create a single expert (admin only) */
export async function POST(req: Request) {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response

  try {
    await ensureTaxonomySeeded()
    const body = await req.json()
    const required = ["name", "categorySlug", "categoryName", "subcategory", "bio", "pricePerSession"]
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Feld '${field}' ist erforderlich.` }, { status: 400 })
      }
    }

    const expert = await prisma.expert.create({
      data: {
        name: body.name,
        email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : emailForName(body.name),
        avatar: body.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
        categorySlug: body.categorySlug,
        categoryName: body.categoryName,
        subcategory: body.subcategory,
        bio: body.bio,
        rating: body.rating ?? 5.0,
        reviewCount: 0,
        sessionCount: 0,
        responseTime: body.responseTime ?? "< 5 Min",
        priceVideo15Min: Math.max(1, body.priceVideo15Min != null ? Number(body.priceVideo15Min) : Number(body.pricePerSession) / 2),
        priceVoice15Min: Math.max(1, body.priceVoice15Min != null ? Number(body.priceVoice15Min) : Number(body.pricePerSession) / 2),
        pricePerSession: Number(body.pricePerSession),
        isLive: body.isLive ?? false,
        isPro: body.isPro ?? false,
        verified: false,
        portfolio: [],
        joinedDate: new Date().toISOString().slice(0, 10),
        imageUrl: body.imageUrl ?? "",
        matchRate: body.matchRate ?? 85,
      },
    })

    const cat = await prisma.taxonomyCategory.findUnique({ where: { slug: body.categorySlug } })
    if (cat) {
      let spec = await prisma.taxonomySpecialty.findFirst({
        where: { categoryId: cat.id, name: String(body.subcategory).trim(), isActive: true },
      })
      if (!spec) {
        const maxSort = await prisma.taxonomySpecialty.aggregate({
          where: { categoryId: cat.id },
          _max: { sortOrder: true },
        })
        spec = await prisma.taxonomySpecialty.create({
          data: {
            categoryId: cat.id,
            name: String(body.subcategory).trim(),
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            isActive: true,
          },
        })
      }
      await prisma.categoryOnExpert.create({ data: { expertId: expert.id, categoryId: cat.id } })
      await prisma.specialtyOnExpert.create({ data: { expertId: expert.id, specialtyId: spec.id } })
      await prisma.expert.update({
        where: { id: expert.id },
        data: {
          primaryCategoryId: cat.id,
          primarySpecialtyId: spec.id,
        },
      })
    }

    return NextResponse.json(
      { success: true, message: `Experte '${expert.name}' erfolgreich erstellt.`, id: expert.id },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler beim Erstellen"
    console.error("[diAiway] POST /api/takumis error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

/** PATCH — update expert (admin only, e.g. isLive toggle) */
export async function PATCH(req: Request) {
  const authResult = await requireAdmin()
  if (authResult.response) return authResult.response

  try {
    const body = await req.json()
    const { id } = body
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Experten-ID erforderlich." }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body.isLive === "boolean") data.isLive = body.isLive
    if (body.isPro !== undefined) data.isPro = !!body.isPro
    if (body.verified !== undefined) data.verified = !!body.verified

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen angegeben." }, { status: 400 })
    }

    await prisma.expert.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler beim Aktualisieren"
    console.error("[diAiway] PATCH /api/takumis error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

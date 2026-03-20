import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ensureTaxonomySeeded } from "@/lib/taxonomy-server"
import { getStaticCategoriesFallback } from "@/lib/taxonomy-fallback"
import { corsPreflightResponse, withApiCors } from "@/lib/api-cors"

export const runtime = "nodejs"

function categoriesToPayload(cats: ReturnType<typeof getStaticCategoriesFallback>) {
  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    iconKey: c.icon,
    iconImageUrl: c.iconImageUrl ?? null,
    color: c.color,
    sortOrder: 0,
    specialties: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
    takumiCount: c.takumiCount ?? 0,
  }))
}

/** Öffentlich: aktive Kategorien inkl. Fachbereiche (für App / Profil). */
export async function GET(request: Request) {
  try {
    await ensureTaxonomySeeded()
    const [categories, counts] = await Promise.all([
      prisma.taxonomyCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          specialties: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true },
          },
        },
      }),
      prisma.categoryOnExpert.groupBy({
        by: ["categoryId"],
        _count: { expertId: true },
      }),
    ])
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count.expertId]))

    const payload = categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      iconKey: c.iconKey,
      iconImageUrl: c.iconImageUrl,
      color: c.color,
      sortOrder: c.sortOrder,
      specialties: c.specialties,
      takumiCount: countMap.get(c.id) ?? 0,
    }))

    return withApiCors(
      request,
      NextResponse.json(
        { categories: payload },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      ),
    )
  } catch (err: unknown) {
    console.error("[taxonomy/categories GET] Fallback (Migration fehlt?):", err)
    const payload = categoriesToPayload(getStaticCategoriesFallback())
    return withApiCors(
      request,
      NextResponse.json(
        { categories: payload },
        {
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
          },
        },
      ),
    )
  }
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request)
}

import { prisma } from "@/lib/db"
import { categories as staticCategories } from "@/lib/categories"
import { isValidTaxonomyIconKey } from "@/lib/taxonomy-icons"
import { apiCategoryToCategory } from "@/lib/taxonomy-dto"
import type { Category } from "@/lib/types"
import { getStaticCategoriesFallback, getStaticCategoryBySlugFallback } from "@/lib/taxonomy-fallback"

/**
 * True, wenn die Taxonomie-Migration auf der DB liegt (`TaxonomyCategory` + `TaxonomySpecialty`).
 * Sonst: `prisma migrate deploy` (Migration `20260320120000_taxonomy_categories`).
 */
export async function isTaxonomySchemaAvailable(): Promise<boolean> {
  try {
    await Promise.all([
      prisma.taxonomyCategory.findFirst({ select: { id: true } }),
      prisma.taxonomySpecialty.findFirst({ select: { id: true } }),
    ])
    return true
  } catch {
    return false
  }
}

/** Legt die Standard-Kategorien aus lib/categories.ts an, falls die Tabelle leer ist. */
export async function ensureTaxonomySeeded(): Promise<void> {
  try {
    const n = await prisma.taxonomyCategory.count()
    if (n > 0) return
  } catch (err) {
    console.warn("[ensureTaxonomySeeded] Taxonomie-Schema fehlt oder DB-Fehler — bitte Migration ausführen:", err)
    return
  }

  for (let i = 0; i < staticCategories.length; i++) {
    const c = staticCategories[i]
    const cat = await prisma.taxonomyCategory.create({
      data: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        iconKey: isValidTaxonomyIconKey(c.icon) ? c.icon : "Briefcase",
        color: c.color,
        sortOrder: i,
        isActive: true,
      },
    })
    for (let j = 0; j < c.subcategories.length; j++) {
      await prisma.taxonomySpecialty.create({
        data: {
          categoryId: cat.id,
          name: c.subcategories[j],
          sortOrder: j,
          isActive: true,
        },
      })
    }
  }
}

/** Öffentliche Liste (nur aktiv). */
export async function getPublicTaxonomyCategories() {
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
  return categories.map((c) => ({
    ...c,
    takumiCount: countMap.get(c.id) ?? 0,
  }))
}

export async function getTaxonomyCategoryBySlug(slug: string) {
  await ensureTaxonomySeeded()
  return prisma.taxonomyCategory.findFirst({
    where: { slug, isActive: true },
    include: {
      specialties: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      },
    },
  })
}

/** Für Server Components: fertige `Category`-Objekte inkl. Takumi-Zählung. */
export async function getPublicCategoriesForApp(): Promise<Category[]> {
  try {
    const rows = await getPublicTaxonomyCategories()
    return rows.map((c) =>
      apiCategoryToCategory({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        iconKey: c.iconKey,
        iconImageUrl: c.iconImageUrl,
        color: c.color,
        specialties: c.specialties,
        takumiCount: c.takumiCount,
      }),
    )
  } catch (err) {
    console.error(
      "[getPublicCategoriesForApp] DB-Taxonomie nicht verfügbar — statischer Fallback. Migration `20260320120000_taxonomy_categories` ausführen.",
      err,
    )
    return getStaticCategoriesFallback()
  }
}

export async function getCategoryForAppBySlug(slug: string): Promise<Category | null> {
  try {
    const row = await getTaxonomyCategoryBySlug(slug)
    if (!row) return getStaticCategoryBySlugFallback(slug)
    const count = await prisma.categoryOnExpert.count({ where: { categoryId: row.id } })
    return apiCategoryToCategory({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      iconKey: row.iconKey,
      iconImageUrl: row.iconImageUrl,
      color: row.color,
      specialties: row.specialties,
      takumiCount: count,
    })
  } catch (err) {
    console.error("[getCategoryForAppBySlug] Fallback für slug=%s:", slug, err)
    return getStaticCategoryBySlugFallback(slug)
  }
}

/** Admin: inkl. inaktiv */
export async function getAllTaxonomyCategoriesAdmin() {
  await ensureTaxonomySeeded()
  return prisma.taxonomyCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      specialties: {
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { categoryOnExperts: true } },
    },
  })
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "kategorie"
}

export async function generateUniqueCategorySlug(base: string): Promise<string> {
  const s = slugify(base)
  let n = 0
  while (true) {
    const candidate = n === 0 ? s : `${s}-${n}`
    const exists = await prisma.taxonomyCategory.findUnique({ where: { slug: candidate } })
    if (!exists) return candidate
    n++
  }
}

/** Verknüpft bestehende Experts ohne Zuordnung anhand der Legacy-Felder. */
export async function backfillExpertTaxonomyFromLegacy(): Promise<{ updated: number }> {
  await ensureTaxonomySeeded()
  const experts = await prisma.expert.findMany({
    select: {
      id: true,
      categorySlug: true,
      subcategory: true,
      categoryName: true,
    },
  })
  let updated = 0
  for (const e of experts) {
    const existing = await prisma.categoryOnExpert.count({ where: { expertId: e.id } })
    if (existing > 0) continue

    const cat = await prisma.taxonomyCategory.findUnique({
      where: { slug: e.categorySlug },
    })
    if (!cat) continue

    await prisma.$transaction(async (tx) => {
      await tx.categoryOnExpert.create({
        data: { expertId: e.id, categoryId: cat.id },
      })
      let spec = await tx.taxonomySpecialty.findFirst({
        where: {
          categoryId: cat.id,
          name: e.subcategory.trim(),
          isActive: true,
        },
      })
      if (!spec && e.subcategory.trim()) {
        const maxSort = await tx.taxonomySpecialty.aggregate({
          where: { categoryId: cat.id },
          _max: { sortOrder: true },
        })
        spec = await tx.taxonomySpecialty.create({
          data: {
            categoryId: cat.id,
            name: e.subcategory.trim(),
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            isActive: true,
          },
        })
      }
      if (!spec) {
        spec = await tx.taxonomySpecialty.findFirst({
          where: { categoryId: cat.id, isActive: true },
          orderBy: { sortOrder: "asc" },
        })
      }
      if (spec) {
        await tx.specialtyOnExpert.create({
          data: { expertId: e.id, specialtyId: spec.id },
        })
        await tx.expert.update({
          where: { id: e.id },
          data: {
            primaryCategoryId: cat.id,
            primarySpecialtyId: spec.id,
          },
        })
      } else {
        await tx.expert.update({
          where: { id: e.id },
          data: { primaryCategoryId: cat.id },
        })
      }
    })
    updated++
  }
  return { updated }
}

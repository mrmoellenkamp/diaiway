import { categories as staticCategories } from "@/lib/categories"
import { apiCategoryToCategory } from "@/lib/taxonomy-dto"
import { isValidTaxonomyIconKey } from "@/lib/taxonomy-icons"
import type { Category } from "@/lib/types"

/**
 * Wenn Taxonomie-Tabellen fehlen (Migration nicht ausgeführt) oder DB-Fehler:
 * gleiche Inhalte wie früher aus `lib/categories.ts` — stabile IDs für Client-State.
 */
export function getStaticCategoriesFallback(): Category[] {
  return staticCategories.map((c) =>
    apiCategoryToCategory({
      id: `fallback-${c.slug}`,
      slug: c.slug,
      name: c.name,
      description: c.description,
      iconKey: isValidTaxonomyIconKey(c.icon) ? c.icon : "Briefcase",
      iconImageUrl: null,
      color: c.color,
      specialties: c.subcategories.map((name, j) => ({
        id: `fallback-${c.slug}-s${j}`,
        name,
      })),
      takumiCount: 0,
    }),
  )
}

export function getStaticCategoryBySlugFallback(slug: string): Category | null {
  return getStaticCategoriesFallback().find((c) => c.slug === slug) ?? null
}

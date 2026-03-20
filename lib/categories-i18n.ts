"use client"

import { useMemo } from "react"
import { useI18n } from "@/lib/i18n"
import { categories as rawCategories } from "@/lib/categories"
import type { Category } from "@/lib/types"

/**
 * Returns the full categories array with names, descriptions and subcategories
 * translated to the active locale. Memoized per locale change.
 */
export function useCategories(): Category[] {
  const { t } = useI18n()

  return useMemo(
    () =>
      rawCategories.map((cat) => ({
        ...cat,
        name: t(`cat.${cat.slug}` as Parameters<typeof t>[0]),
        description: t(`cat.${cat.slug}.desc` as Parameters<typeof t>[0]),
        subcategories: cat.subcategories.map(
          (_, i) => t(`cat.${cat.slug}.sub${i}` as Parameters<typeof t>[0])
        ),
      })),
     
    [t]
  )
}

/**
 * Returns a single translated category by slug.
 */
export function useCategory(slug: string): Category | undefined {
  const categories = useCategories()
  return useMemo(() => categories.find((c) => c.slug === slug), [categories, slug])
}

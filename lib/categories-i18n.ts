"use client"

import { useEffect, useMemo, useState } from "react"
import { useI18n } from "@/lib/i18n"
import { apiCategoryToCategory, type ApiTaxonomyCategory } from "@/lib/taxonomy-dto"
import type { Category } from "@/lib/types"

/**
 * Kategorien aus der API (DB). Optional `initial` vom Server, um ohne Flackern zu rendern.
 */
export function useCategories(initial?: Category[] | null): Category[] {
  const [cats, setCats] = useState<Category[]>(() => (initial && initial.length > 0 ? initial : []))
  useEffect(() => {
    if (initial && initial.length > 0) {
      setCats(initial)
      return
    }
    let cancelled = false
    fetch("/api/taxonomy/categories")
      .then((r) => r.json())
      .then((j: { categories: ApiTaxonomyCategory[] }) => {
        if (cancelled) return
        setCats((j.categories ?? []).map(apiCategoryToCategory))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [initial])

  return cats
}

/**
 * Namen optional mit i18n-Keys `cat.{slug}` überschreiben, falls vorhanden.
 */
export function useLocalizedCategories(base: Category[]): Category[] {
  const { t } = useI18n()
  return useMemo(
    () =>
      base.map((cat) => {
        const nameKey = `cat.${cat.slug}` as Parameters<typeof t>[0]
        const descKey = `cat.${cat.slug}.desc` as Parameters<typeof t>[0]
        const nameT = t(nameKey)
        const descT = t(descKey)
        const subLabels = cat.subcategories.map((sub, i) => {
          const sk = `cat.${cat.slug}.sub${i}` as Parameters<typeof t>[0]
          const st = t(sk)
          return {
            id: sub.id,
            name: st !== sk ? st : sub.name,
          }
        })
        return {
          ...cat,
          name: nameT !== nameKey ? nameT : cat.name,
          description: descT !== descKey ? descT : cat.description,
          subcategories: subLabels,
        }
      }),
    [base, t],
  )
}

export function useCategory(slug: string): Category | undefined {
  const cats = useCategories()
  return useMemo(() => cats.find((c) => c.slug === slug), [cats, slug])
}

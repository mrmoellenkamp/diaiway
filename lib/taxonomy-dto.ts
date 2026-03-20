import type { Category } from "@/lib/types"

export type ApiTaxonomyCategory = {
  id: string
  slug: string
  name: string
  description: string
  iconKey: string
  iconImageUrl: string | null
  color: string
  specialties: { id: string; name: string }[]
  takumiCount?: number
}

export function apiCategoryToCategory(c: ApiTaxonomyCategory): Category {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.iconKey,
    iconImageUrl: c.iconImageUrl,
    description: c.description,
    subcategories: c.specialties.map((s) => ({ id: s.id, name: s.name })),
    takumiCount: c.takumiCount ?? 0,
    color: c.color,
  }
}

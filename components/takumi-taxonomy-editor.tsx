"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/lib/i18n"
import type { Category } from "@/lib/types"
import { cn } from "@/lib/utils"

export type TakumiTaxonomyValue = {
  categoryIds: string[]
  specialtyIds: string[]
  primaryCategoryId: string
  primarySpecialtyId: string
}

function findSpecLocation(categories: Category[], specialtyId: string) {
  for (const c of categories) {
    const s = c.subcategories.find((x) => x.id === specialtyId)
    if (s) return { category: c, specialty: s }
  }
  return null
}

export function TakumiTaxonomyEditor({
  categories,
  value,
  onChange,
}: {
  categories: Category[]
  value: TakumiTaxonomyValue
  onChange: (v: TakumiTaxonomyValue) => void
}) {
  const { t } = useI18n()

  function toggleCategory(categoryId: string) {
    const has = value.categoryIds.includes(categoryId)
    const categoryIds = has ? value.categoryIds.filter((x) => x !== categoryId) : [...value.categoryIds, categoryId]
    let specialtyIds = value.specialtyIds
    if (has) {
      const cat = categories.find((c) => c.id === categoryId)
      const drop = new Set((cat?.subcategories ?? []).map((s) => s.id))
      specialtyIds = specialtyIds.filter((sid) => !drop.has(sid))
    }
    let primaryCategoryId = value.primaryCategoryId
    let primarySpecialtyId = value.primarySpecialtyId
    if (!categoryIds.includes(primaryCategoryId)) {
      primaryCategoryId = categoryIds[0] ?? ""
      primarySpecialtyId = ""
    }
    if (!specialtyIds.includes(primarySpecialtyId)) {
      primarySpecialtyId = specialtyIds.find((sid) => {
        const loc = findSpecLocation(categories, sid)
        return loc && categoryIds.includes(loc.category.id)
      }) ?? ""
    }
    onChange({ categoryIds, specialtyIds, primaryCategoryId, primarySpecialtyId })
  }

  function toggleSpecialty(specialtyId: string, categoryId: string) {
    if (!value.categoryIds.includes(categoryId)) return
    const has = value.specialtyIds.includes(specialtyId)
    const specialtyIds = has ? value.specialtyIds.filter((x) => x !== specialtyId) : [...value.specialtyIds, specialtyId]
    let primarySpecialtyId = value.primarySpecialtyId
    let primaryCategoryId = value.primaryCategoryId
    if (has && primarySpecialtyId === specialtyId) {
      primarySpecialtyId =
        specialtyIds.find((sid) => {
          const loc = findSpecLocation(categories, sid)
          return loc && value.categoryIds.includes(loc.category.id)
        }) ?? ""
    }
    if (!has && !primarySpecialtyId) {
      primarySpecialtyId = specialtyId
      primaryCategoryId = categoryId
    }
    onChange({ ...value, specialtyIds, primarySpecialtyId, primaryCategoryId })
  }

  function setPrimary(specialtyId: string) {
    const loc = findSpecLocation(categories, specialtyId)
    if (!loc || !value.specialtyIds.includes(specialtyId)) return
    onChange({
      ...value,
      primarySpecialtyId: specialtyId,
      primaryCategoryId: loc.category.id,
    })
  }

  const selectedCategories = categories.filter((c) => value.categoryIds.includes(c.id))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs font-medium text-muted-foreground">{t("editProfile.taxonomyCategories")}</Label>
        <p className="text-[10px] text-muted-foreground mb-2">{t("editProfile.taxonomyCategoriesHint")}</p>
        <div className="flex flex-col gap-2 rounded-lg border border-[rgba(231,229,227,0.6)] p-3">
          {categories.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={value.categoryIds.includes(c.id)}
                onCheckedChange={() => toggleCategory(c.id)}
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      {selectedCategories.length > 0 && (
        <div className="flex flex-col gap-3">
          <Label className="text-xs font-medium text-muted-foreground">{t("editProfile.taxonomySpecialties")}</Label>
          <p className="text-[10px] text-muted-foreground">{t("editProfile.taxonomySpecialtiesHint")}</p>
          {selectedCategories.map((c) => (
            <div key={c.id} className="rounded-lg border border-[rgba(231,229,227,0.5)] bg-[rgba(245,245,244,0.2)] p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">{c.name}</p>
              <div className="flex flex-col gap-2">
                {c.subcategories.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={value.specialtyIds.includes(s.id)}
                      onCheckedChange={() => toggleSpecialty(s.id, c.id)}
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {value.specialtyIds.length > 0 && (
        <div>
          <Label className="text-xs font-medium text-muted-foreground">{t("editProfile.taxonomyPrimary")}</Label>
          <p className="text-[10px] text-muted-foreground mb-2">{t("editProfile.taxonomyPrimaryHint")}</p>
          <div className="flex flex-col gap-2 rounded-lg border border-[rgba(231,229,227,0.6)] p-3">
            {value.specialtyIds.map((sid) => {
              const loc = findSpecLocation(categories, sid)
              if (!loc) return null
              return (
                <label
                  key={sid}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-[rgba(245,245,244,0.5)]",
                    value.primarySpecialtyId === sid && "bg-[rgba(6,78,59,0.1)]",
                  )}
                >
                  <input
                    type="radio"
                    name="primarySpec"
                    className="size-4 accent-primary"
                    checked={value.primarySpecialtyId === sid}
                    onChange={() => setPrimary(sid)}
                  />
                  <span>
                    {loc.category.name} — {loc.specialty.name}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

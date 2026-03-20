"use client"

import Link from "next/link"
import type { Category } from "@/lib/types"
import { useI18n } from "@/lib/i18n"
import { TaxonomyCategoryIcon } from "@/components/taxonomy-category-icon"

export function CategoryCard({ category }: { category: Category }) {
  const { t } = useI18n()

  return (
    <Link href={`/categories/${category.slug}`}>
      <div className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-center transition-all hover:border-primary/30 hover:shadow-md">
        <div
          className="flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${category.color}15` }}
        >
          <TaxonomyCategoryIcon
            iconKey={category.icon}
            iconImageUrl={category.iconImageUrl}
            color={category.color}
            size={22}
            className="size-[22px]"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground leading-tight">
            {category.name}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {category.subcategories.length} {t("cat.areas")}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function CategoryCardLarge({ category }: { category: Category }) {
  const { t } = useI18n()

  return (
    <Link href={`/categories/${category.slug}`}>
      <div className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${category.color}15` }}
        >
          <TaxonomyCategoryIcon
            iconKey={category.icon}
            iconImageUrl={category.iconImageUrl}
            color={category.color}
            size={26}
            className="size-[26px]"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold text-foreground">{category.name}</span>
          <span className="text-xs text-muted-foreground">{category.description}</span>
          <span className="text-[10px] text-muted-foreground">
            {category.subcategories.length} {t("cat.areas")}
          </span>
        </div>
      </div>
    </Link>
  )
}

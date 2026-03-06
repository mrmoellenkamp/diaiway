"use client"

import Link from "next/link"
import {
  Smartphone, Home, Car, Shirt, Baby, PawPrint, Music,
  Palette, Briefcase, GraduationCap, Wrench,
} from "lucide-react"
import type { Category } from "@/lib/types"
import { useI18n } from "@/lib/i18n"

const iconMap: Record<string, React.ElementType> = {
  Smartphone, Home, Car, Shirt, Baby, PawPrint, Music,
  Palette, Briefcase, GraduationCap, Wrench,
}

export function CategoryCard({ category }: { category: Category }) {
  const { t } = useI18n()
  const Icon = iconMap[category.icon] || Briefcase

  return (
    <Link href={`/categories/${category.slug}`}>
      <div className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-center transition-all hover:border-primary/30 hover:shadow-md">
        <div
          className="flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${category.color}15` }}
        >
          <Icon className="size-5" style={{ color: category.color }} />
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
  const Icon = iconMap[category.icon] || Briefcase

  return (
    <Link href={`/categories/${category.slug}`}>
      <div className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${category.color}15` }}
        >
          <Icon className="size-6" style={{ color: category.color }} />
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

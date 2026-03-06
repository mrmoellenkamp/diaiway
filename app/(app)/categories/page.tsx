"use client"

import { PageContainer } from "@/components/page-container"
import { CategoryCardLarge } from "@/components/category-card"
import { useCategories } from "@/lib/categories-i18n"
import { useI18n } from "@/lib/i18n"

export default function CategoriesPage() {
  const { t } = useI18n()
  const categories = useCategories()
  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("categories.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("categories.count", { count: categories.length })}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {categories.map((cat) => (
            <CategoryCardLarge key={cat.slug} category={cat} />
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

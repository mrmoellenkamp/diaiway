"use client"

import useSWR from "swr"
import { PageContainer } from "@/components/page-container"
import { TakumiCard } from "@/components/takumi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCategories } from "@/lib/categories-i18n"
import { useI18n } from "@/lib/i18n"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { Takumi } from "@/lib/types"
import type { Category } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<Takumi[]>

interface CategoryDetailPageClientProps {
  slug: string
  category: Category
  categoryTakumis: Takumi[]
}

export function CategoryDetailPageClient({ slug, category, categoryTakumis }: CategoryDetailPageClientProps) {
  const { t } = useI18n()
  const categories = useCategories()
  const resolvedCategory = categories.find((c) => c.slug === slug) ?? category

  const { data: allTakumis } = useSWR<Takumi[]>("/api/takumis", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const takumis = allTakumis ? allTakumis.filter((tk) => tk.categorySlug === slug) : categoryTakumis

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/categories">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{resolvedCategory.name}</h1>
            <p className="text-xs text-muted-foreground">{resolvedCategory.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {resolvedCategory.subcategories.map((sub) => (
            <Badge key={sub} variant="outline" className="text-xs">
              {sub}
            </Badge>
          ))}
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {takumis.length > 0
              ? t("categoryDetail.expertsFound").replace("{count}", String(takumis.length))
              : t("categoryDetail.expertsInCategory").replace("{count}", String(resolvedCategory.takumiCount))}
          </p>
          <div className="flex flex-col gap-3">
            {takumis.length > 0 ? (
              takumis.map((tk, index) => (
                <TakumiCard key={tk.id} takumi={tk} priority={index < 3} />
              ))
            ) : (
              <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
                <p className="font-jp text-3xl text-muted-foreground/30 mb-2">匠</p>
                <p className="text-sm text-muted-foreground">
                  {t("categoryDetail.loading")}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="scroll-end-spacer" aria-hidden />
      </div>
    </PageContainer>
  )
}

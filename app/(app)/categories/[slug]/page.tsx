"use client"

import { use } from "react"
import { PageContainer } from "@/components/page-container"
import { TakumiCard } from "@/components/takumi-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { categories } from "@/lib/categories"
import { useTakumis } from "@/hooks/use-takumis"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()

  const { takumis } = useTakumis()
  const categoryTakumis = takumis.filter((t) => t.categorySlug === slug)

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
            <h1 className="text-lg font-bold text-foreground">{category.name}</h1>
            <p className="text-xs text-muted-foreground">{category.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {category.subcategories.map((sub) => (
            <Badge key={sub} variant="outline" className="text-xs">
              {sub}
            </Badge>
          ))}
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-3">
            {categoryTakumis.length > 0
              ? `${categoryTakumis.length} Experten gefunden`
              : `${category.takumiCount} Experten in dieser Kategorie`}
          </p>
          <div className="flex flex-col gap-3">
            {categoryTakumis.length > 0 ? (
              categoryTakumis.map((t) => (
                <TakumiCard key={t.id} takumi={t} />
              ))
            ) : (
              <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
                <p className="font-jp text-3xl text-muted-foreground/30 mb-2">匠</p>
                <p className="text-sm text-muted-foreground">
                  Experten werden geladen...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

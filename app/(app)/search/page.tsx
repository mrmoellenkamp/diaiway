"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { PageContainer } from "@/components/page-container"
import { TakumiCard } from "@/components/takumi-card"
import { useCategories } from "@/lib/categories-i18n"
import { useTakumis } from "@/hooks/use-takumis"
import { useI18n } from "@/lib/i18n"
import { Search as SearchIcon } from "lucide-react"

function SearchContent() {
  const { t } = useI18n()
  const categories = useCategories()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""
  const [query, setQuery] = useState(initialQuery)
  const { takumis } = useTakumis()

  const results = query.length > 1
    ? takumis.filter(
        (tk) =>
          tk.name.toLowerCase().includes(query.toLowerCase()) ||
          tk.categoryName.toLowerCase().includes(query.toLowerCase()) ||
          tk.subcategory.toLowerCase().includes(query.toLowerCase()) ||
          tk.bio.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const q = query.toLowerCase().trim()
  const catResults = query.length > 1
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.subcategories.some((sub) => sub.toLowerCase().includes(q))
      )
    : []

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 rounded-xl pl-10"
          autoFocus
        />
      </div>

      {query.length > 1 && (
        <div className="flex flex-col gap-4">
          {catResults.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {t("search.categoriesLabel")}
              </p>
              <div className="flex flex-col gap-2">
                {catResults.map((c) => {
                  const matchingSubs = c.subcategories.filter((sub) =>
                    sub.toLowerCase().includes(q)
                  )
                  return (
                    <Link
                      key={c.slug}
                      href={`/categories/${c.slug}`}
                      className="block rounded-xl border border-border/60 bg-card p-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium">{c.name}</span>
                      {matchingSubs.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {matchingSubs.map((sub) => (
                            <span
                              key={sub}
                              className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t("search.expertsLabel").replace("{count}", String(results.length))}
            </p>
            <div className="flex flex-col gap-3">
              {results.map((tk) => (
                <TakumiCard key={tk.id} takumi={tk} />
              ))}
              {results.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {t("search.noResults").replace("{query}", query)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {query.length <= 1 && (
        <div className="py-12 text-center">
          <p className="font-jp text-3xl text-muted-foreground/30 mb-2">探</p>
          <p className="text-sm text-muted-foreground">
            {t("search.hint")}
          </p>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <PageContainer>
      <Suspense>
        <SearchContent />
      </Suspense>
    </PageContainer>
  )
}

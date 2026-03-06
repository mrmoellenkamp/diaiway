"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { PageContainer } from "@/components/page-container"
import { TakumiCard } from "@/components/takumi-card"
import { categories } from "@/lib/categories"
import { useTakumis } from "@/hooks/use-takumis"
import { Search as SearchIcon } from "lucide-react"

function SearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""
  const [query, setQuery] = useState(initialQuery)
  const { takumis } = useTakumis()

  const results = query.length > 1
    ? takumis.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.categoryName.toLowerCase().includes(query.toLowerCase()) ||
          t.subcategory.toLowerCase().includes(query.toLowerCase()) ||
          t.bio.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const catResults = query.length > 1
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase())
      )
    : []

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Experten, Kategorien, Themen..."
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
              <p className="text-xs font-medium text-muted-foreground mb-2">KATEGORIEN</p>
              <div className="flex flex-col gap-2">
                {catResults.map((c) => (
                  <div key={c.slug} className="rounded-xl border border-border/60 bg-card p-3 text-sm">
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {results.length} EXPERTEN
            </p>
            <div className="flex flex-col gap-3">
              {results.map((t) => (
                <TakumiCard key={t.id} takumi={t} />
              ))}
              {results.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Keine Ergebnisse fur &ldquo;{query}&rdquo;
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
            Suche nach Experten oder Themen
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

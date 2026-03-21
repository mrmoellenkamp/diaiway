"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Newspaper, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type HomeNewsItemDto = {
  id: string
  title: string
  body: string
  linkUrl: string | null
  linkLabel: string | null
  publishedAt: string | null
  /** Welche Sprachfassung geliefert wurde (bei Fallback ggf. ≠ UI-Locale) */
  localeUsed?: string
}

export function HomeNewsFeed({ className }: { className?: string }) {
  const { t, locale } = useI18n()
  const [items, setItems] = useState<HomeNewsItemDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const q = new URLSearchParams({ locale })
        const res = await fetch(`/api/home-news?${q}`)
        const data = await res.json()
        if (!cancelled && Array.isArray(data.items)) setItems(data.items)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [locale])

  if (loading) {
    return (
      <section className={cn("rounded-2xl border border-border/60 bg-card/40 px-4 py-6", className)}>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">{t("home.newsLoading")}</span>
        </div>
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section className={cn("rounded-2xl border border-border/60 bg-card/50 overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-border/50 bg-primary/[0.04] px-4 py-2.5">
        <Newspaper className="size-4 text-primary shrink-0" />
        <h2 className="text-sm font-bold text-foreground">{t("home.newsTitle")}</h2>
      </div>
      <ul className="divide-y divide-border/40">
        {items.map((item) => {
          const href = item.linkUrl ?? ""
          const isInternalPath = href.startsWith("/") && !href.startsWith("//")
          return (
            <li key={item.id} className="px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{item.body}</p>
            {item.linkUrl && (
              <Link
                href={item.linkUrl}
                className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
                {...(isInternalPath
                  ? {}
                  : { target: "_blank" as const, rel: "noopener noreferrer" })}
              >
                {item.linkLabel || t("home.newsReadMore")}
              </Link>
            )}
            {item.publishedAt && (
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                {new Date(item.publishedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

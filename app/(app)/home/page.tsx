"use client"

import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TakumiCard, TakumiCardCompact } from "@/components/takumi-card"
import { CategoryCard } from "@/components/category-card"
import { PageContainer } from "@/components/page-container"
import { useCategories } from "@/lib/categories-i18n"
import { useTakumis } from "@/hooks/use-takumis"
import { useApp } from "@/lib/app-context"
import { Search, ArrowRight, Sparkles } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function HomePage() {
  const { userName } = useApp()
  const { t } = useI18n()
  const categories = useCategories()
  const { takumis, isEmpty } = useTakumis()
  const liveTakumis = takumis.filter((t) => t.isLive)
  const recommendedTakumis = takumis.filter((t) => t.rating >= 4.8)
  const newTakumis = takumis.slice(-3)

  return (
    <PageContainer noPadding>
      <div className="flex flex-col gap-6 pb-4">
        {/* Greeting + Search */}
        <div className="px-4 pt-4 flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("home.greeting")}</p>
            <h1 className="text-xl font-bold text-foreground">{userName}</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("home.searchPlaceholder")}
              className="h-11 rounded-xl pl-10"
            />
          </div>
        </div>

        {/* AI-Guide CTA */}
        <div className="px-4">
          <Link href="/ai-guide">
            <div className="flex items-center gap-3 rounded-xl bg-primary p-4 transition-shadow hover:shadow-md">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/20">
                <Sparkles className="size-5 text-accent" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-primary-foreground">
                  {t("common.aiGuide")}
                </span>
                <span className="text-xs text-primary-foreground/70">
                  {t("home.aiGuideDesc")}
                </span>
              </div>
              <ArrowRight className="size-4 text-primary-foreground/50" />
            </div>
          </Link>
        </div>

        {/* Live Takumis Carousel */}
        <section>
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-base font-bold text-foreground">{t("home.nowLive")}</h2>
            {liveTakumis.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-accent font-medium">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                {liveTakumis.length} {t("home.online")}
              </span>
            )}
          </div>
          {liveTakumis.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
              {liveTakumis.map((t) => (
                <TakumiCardCompact key={t.id} takumi={t} />
              ))}
            </div>
          ) : (
            <div className="mx-4 rounded-xl border border-border/60 bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {t("home.noExpertsOnline")}
              </p>
            </div>
          )}
        </section>

        {/* Categories */}
        <section className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">{t("common.categories")}</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs text-primary h-auto p-0">
              <Link href="/categories">
                {t("common.all")}
                <ArrowRight className="ml-0.5 size-3" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categories.slice(0, 6).map((cat) => (
              <CategoryCard key={cat.slug} category={cat} />
            ))}
          </div>
        </section>

        {/* Recommended */}
        <section className="px-4">
          <h2 className="text-base font-bold text-foreground mb-3">{t("home.recommended")}</h2>
          {recommendedTakumis.length > 0 ? (
            <div className="flex flex-col gap-3">
              {recommendedTakumis.slice(0, 3).map((t) => (
                <TakumiCard key={t.id} takumi={t} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
              <p className="font-jp text-xl text-muted-foreground/30 mb-1">匠</p>
              <p className="text-xs text-muted-foreground">
                {isEmpty ? t("home.noExperts") : t("home.noRecommendations")}
              </p>
            </div>
          )}
        </section>

        {/* New on diAiway */}
        {newTakumis.length > 0 && (
          <section className="px-4">
            <h2 className="text-base font-bold text-foreground mb-3">{t("home.newOnPlatform")}</h2>
            <div className="flex flex-col gap-3">
              {newTakumis.map((t) => (
                <TakumiCard key={t.id} takumi={t} />
              ))}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  )
}

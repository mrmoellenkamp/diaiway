"use client"

import { PageContainer } from "@/components/page-container"
import { CategoryCardLarge } from "@/components/category-card"
import { TakumiCardCompact } from "@/components/takumi-card"
import { CollapsibleAiBox } from "@/components/collapsible-ai-box"
import { useCategories } from "@/lib/categories-i18n"
import { useTakumis } from "@/hooks/use-takumis"
import { useI18n } from "@/lib/i18n"
import { Sparkles } from "lucide-react"

export default function CategoriesPage() {
  const { t } = useI18n()
  const categories = useCategories()
  const { takumis } = useTakumis()
  const liveTakumis = takumis.filter((tk) => tk.isLive)

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* diAiway Intelligence — collapsible, öffnet bei Klick */}
        <section className="flex flex-col gap-3">
          <CollapsibleAiBox
            defaultExpanded={false}
            chatVariant="embedded"
            variant="card"
            title={t("categories.mentorTitle")}
            description={t("categories.mentorDesc")}
          />
        </section>

        {/* Online Takumis (Kurzprofile) */}
        {liveTakumis.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-foreground">{t("home.nowLive")}</h2>
              <span className="flex items-center gap-1 text-xs text-accent font-medium">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                {liveTakumis.length} {t("home.online")}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {liveTakumis.map((tk) => (
                <TakumiCardCompact key={tk.id} takumi={tk} />
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
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
      </div>
    </PageContainer>
  )
}

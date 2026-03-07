"use client"

import { PageContainer } from "@/components/page-container"
import { CategoryCardLarge } from "@/components/category-card"
import { MentorChat } from "@/components/mentor-chat"
import { useCategories } from "@/lib/categories-i18n"
import { useI18n } from "@/lib/i18n"
import { Sparkles } from "lucide-react"

export default function CategoriesPage() {
  const { t } = useI18n()
  const categories = useCategories()
  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* AI Mentor — above categories */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-3.5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                {t("landing.mentorTitle")}
                <span className="font-jp ml-1.5 text-xs font-normal text-primary/30">{"導師"}</span>
              </h2>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              {t("landing.mentorDesc")}
            </p>
          </div>
          <MentorChat variant="embedded" />
        </section>

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

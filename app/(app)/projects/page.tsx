"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/page-container"
import { FolderKanban, ArrowRight } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function ProjectsPage() {
  const { t } = useI18n()
  // Projects will be loaded from DB once the project flow is implemented.
  // Until then, show a meaningful empty state.

  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <FolderKanban className="size-7 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-bold text-foreground">{t("projects.empty")}</h2>
          <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
            {t("projects.emptyDesc")}
          </p>
        </div>
        <Button asChild className="mt-2 gap-2 rounded-xl">
          <Link href="/categories">
            {t("projects.browseCta")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </PageContainer>
  )
}

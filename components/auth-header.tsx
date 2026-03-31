"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n } from "@/lib/i18n"

/** Header für Auth-Seiten (Login, Register, etc.) – Layout wie AppHeader */
export function AuthHeader({ title }: { title: string }) {
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-50 isolate border-b border-border bg-[rgba(255,255,255,0.95)] backdrop-blur-md pointer-events-auto pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex w-full max-w-lg min-w-0 items-center justify-between py-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link
            href="/"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[rgba(245,245,244,0.5)] hover:text-foreground active:bg-muted"
            aria-label={t("common.startPage")}
          >
            <ArrowLeft className="size-5" />
          </Link>
          <Link
            href="/"
            className="flex min-h-11 min-w-11 items-center justify-center gap-2 -m-1 p-1 rounded-lg hover:bg-[rgba(245,245,244,0.5)] active:bg-muted transition-colors"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary shrink-0">
              <span className="text-sm font-bold text-primary-foreground">di</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pl-2">
          <LanguageSwitcher variant="compact" />
        </div>
      </div>
    </header>
  )
}

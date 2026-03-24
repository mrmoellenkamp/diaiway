"use client"

import Link from "next/link"
import { Mail, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useApp } from "@/lib/app-context"
import { useI18n } from "@/lib/i18n"

export function AppHeader({ title }: { title?: string }) {
  const { totalUnread } = useApp()
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-50 isolate border-b border-border bg-card/95 backdrop-blur-md pointer-events-auto pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex w-full max-w-lg min-w-0 items-center justify-between py-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <Link href="/" className="flex min-h-11 min-w-11 items-center justify-center gap-2 -m-1 p-1 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <span className="text-sm font-bold text-primary-foreground">di</span>
          </div>
          {title ? (
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          ) : (
            <span className="text-lg font-semibold text-foreground">
              di<span className="text-accent">Ai</span>way
            </span>
          )}
        </Link>
        <div className="flex items-center gap-0.5">
          <LanguageSwitcher variant="compact" />
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/search">
              <Search className="size-5 icon-paper" />
              <span className="sr-only">{t("common.search")}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild className="relative">
            <Link href="/messages">
              <Mail className="size-5 icon-paper" />
              <span className="sr-only">{t("messages.title")}</span>
              {totalUnread > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
              )}
            </Link>
          </Button>
          <UserNav />
        </div>
      </div>
    </header>
  )
}

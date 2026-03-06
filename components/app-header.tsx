"use client"

import Link from "next/link"
import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useApp } from "@/lib/app-context"
import { useI18n } from "@/lib/i18n"

export function AppHeader({ title }: { title?: string }) {
  const { totalUnread } = useApp()
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-50 isolate border-b border-border bg-card/95 backdrop-blur-md pointer-events-auto">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
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
        <div className="flex items-center gap-1">
          <LanguageSwitcher variant="compact" />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/search">
              <Search className="size-5" />
              <span className="sr-only">{t("common.search")}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/messages">
              <Bell className="size-5" />
              <span className="sr-only">{t("messages.title")}</span>
              {totalUnread > 0 ? (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                  {totalUnread}
                </span>
              ) : (
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

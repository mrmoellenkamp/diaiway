"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Menu, X } from "lucide-react"
import { UserNav } from "@/components/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n } from "@/lib/i18n"

export function LandingHeader() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-50 border-b border-primary-foreground/10 bg-primary/95 backdrop-blur-md pointer-events-auto pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-lg min-w-0 items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/10">
            <span className="text-sm font-bold text-accent">di</span>
          </div>
          <span className="text-base font-bold text-primary-foreground">
            di<span className="text-accent">Ai</span>way
          </span>
        </Link>

        <div className="hidden items-center gap-2 sm:flex">
          <LanguageSwitcher variant="landing" />
          <UserNav variant="landing" />
        </div>

        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="flex size-9 items-center justify-center rounded-lg text-primary-foreground transition-colors hover:bg-primary-foreground/10 sm:hidden"
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-primary-foreground/10 bg-card px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href="/categories"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t("common.categories")}
            </Link>
            <Link
              href={isLoggedIn ? "/home" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t("nav.expertsOverview")}
            </Link>
          </nav>
          <div className="flex items-center gap-2 px-3 py-2">
            <LanguageSwitcher variant="compact" />
          </div>
          <div onClick={() => setMobileMenuOpen(false)}>
            <UserNav variant="mobile" />
          </div>
        </div>
      )}
    </header>
  )
}


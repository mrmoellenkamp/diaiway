"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const HIDDEN_ON = ["/", "/login", "/register", "/signup", "/onboarding", "/session", "/booking", "/pay", "/beta"]

export function Footer() {
  const pathname = usePathname()
  const { t } = useI18n()

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null
  }

  const hasBottomNav =
    pathname.startsWith("/home") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/ai-guide") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/sessions") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/dashboard")

  const colClass = "flex flex-col gap-3"
  const headerClass = "text-sm font-semibold text-foreground"
  const linkClass = "text-xs text-[rgba(120,113,108,0.8)] transition-colors hover:text-foreground block"

  return (
    <footer
      aria-label="Footer"
      className={cn(
        "w-full border-t border-[rgba(231,229,227,0.6)] bg-[rgba(255,255,255,0.5)]",
        hasBottomNav ? "pb-24" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* 4-column grid: Entdecken | Support | Legal | Mission */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {/* 1. Entdecken */}
          <div className={colClass}>
            <span className={headerClass}>{t("footer.discover")}</span>
            <Link href="/how-it-works" className={linkClass}>
              {t("footer.howItWorks")}
            </Link>
            <Link href="/categories" className={linkClass}>
              {t("footer.categories")}
            </Link>
            <Link href="/ai-guide" className={linkClass}>
              {t("common.aiGuide")}
            </Link>
          </div>

          {/* 2. Support */}
          <div className={colClass}>
            <span className={headerClass}>{t("footer.support")}</span>
            <Link href="/help" className={linkClass}>
              {t("footer.helpSupport")}
            </Link>
            <Link href="/help#faq" className={linkClass}>
              {t("footer.faq")}
            </Link>
            <Link href="/help#ticket" className={linkClass}>
              {t("footer.supportTicket")}
            </Link>
          </div>

          {/* 3. Legal */}
          <div className={colClass}>
            <span className={headerClass}>{t("footer.legal")}</span>
            <Link href="/legal/impressum" className={linkClass}>
              {t("footer.imprint")}
            </Link>
            <Link href="/legal/datenschutz" className={linkClass}>
              {t("footer.privacy")}
            </Link>
            <Link href="/legal/agb" className={linkClass}>
              {t("landing.terms")}
            </Link>
          </div>

          {/* 4. Mission */}
          <div className={colClass}>
            <span className={headerClass}>{t("footer.mission")}</span>
            <p className="text-xs text-[rgba(120,113,108,0.8)] leading-relaxed">
              {t("footer.missionText")}
            </p>
            <a href="mailto:kontakt@diaiway.com" className={linkClass}>
              {t("footer.newsletterContact")}
            </a>
          </div>
        </div>

        {/* Brand + Copyright */}
        <div className="mt-8 flex flex-col items-center gap-1 border-t border-[rgba(231,229,227,0.4)] pt-6">
          <span className="text-sm font-semibold text-foreground">
            di<span className="text-accent">Ai</span>way
          </span>
          <p className="text-[11px] text-[rgba(120,113,108,0.7)]">
            {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  )
}

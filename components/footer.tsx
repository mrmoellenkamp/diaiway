"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import {
  Compass,
  HelpCircle,
  Shield,
  Mail,
  FileText,
  BookOpen,
  Sparkles,
  Heart,
} from "lucide-react"
import { cn } from "@/lib/utils"

const HIDDEN_ON = ["/", "/login", "/register", "/signup", "/onboarding", "/session", "/booking"]

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
  const linkClass = "text-xs text-muted-foreground/80 transition-colors hover:text-foreground flex items-center gap-2"

  return (
    <footer
      aria-label="Footer"
      className={cn(
        "w-full border-t border-border/60 bg-card/50",
        hasBottomNav ? "pb-24" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* 4-column grid: Entdecken | Support | Legal | Mission */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {/* 1. Entdecken (Brand) */}
          <div className={colClass}>
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("footer.discover")}
              </span>
            </div>
            <Link href="/how-it-works" className={linkClass}>
              <Sparkles className="size-3.5" />
              {t("footer.howItWorks")}
            </Link>
            <Link href="/categories" className={linkClass}>
              {t("footer.categories")}
            </Link>
            <Link href="/ai-guide" className={linkClass}>
              {t("common.aiGuide")}
            </Link>
          </div>

          {/* 2. Support (User-Hilfe) */}
          <div className={colClass}>
            <div className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("footer.support")}
              </span>
            </div>
            <Link href="/help" className={linkClass}>
              <BookOpen className="size-3.5" />
              {t("footer.helpSupport")}
            </Link>
            <Link href="/help#faq" className={linkClass}>
              {t("footer.faq")}
            </Link>
            <Link href="/help#ticket" className={linkClass}>
              <Mail className="size-3.5" />
              {t("footer.supportTicket")}
            </Link>
          </div>

          {/* 3. Legal (Sicherheit) */}
          <div className={colClass}>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("footer.legal")}
              </span>
            </div>
            <Link href="/legal/impressum" className={linkClass}>
              <FileText className="size-3.5" />
              {t("footer.imprint")}
            </Link>
            <Link href="/legal/datenschutz" className={linkClass}>
              {t("footer.privacy")}
            </Link>
            <Link href="/legal/agb" className={linkClass}>
              {t("landing.terms")}
            </Link>
          </div>

          {/* 4. Mission (Social / Newsletter) */}
          <div className={colClass}>
            <div className="flex items-center gap-2">
              <Heart className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {t("footer.mission")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              {t("footer.missionText")}
            </p>
            <a
              href="mailto:kontakt@diaiway.com"
              className={linkClass}
            >
              <Mail className="size-3.5" />
              {t("footer.newsletterContact")}
            </a>
          </div>
        </div>

        {/* Brand + Copyright */}
        <div className="mt-8 flex flex-col items-center gap-1 border-t border-border/40 pt-6">
          <span className="text-sm font-semibold text-foreground">
            di<span className="text-accent">Ai</span>way
          </span>
          <p className="text-[11px] text-muted-foreground/70">
            {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  )
}

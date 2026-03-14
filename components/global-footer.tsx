"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n"

// Pages where the footer should NOT appear (full-screen flows)
const HIDDEN_ON = ["/login", "/register", "/signup", "/onboarding", "/session", "/booking"]

export function GlobalFooter() {
  const pathname = usePathname()
  const { t } = useI18n()

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null
  }

  // Add extra bottom padding when BottomNav is present
  const hasBottomNav =
    pathname.startsWith("/home") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/ai-guide") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/sessions") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/dashboard")

  return (
    <footer
      className={`w-full py-4 text-center ${hasBottomNav ? "pb-24" : "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"}`}
      aria-label="Legal and support links"
    >
      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/60">
        <Link
          href="/legal/datenschutz"
          className="transition-colors hover:text-muted-foreground"
        >
          {t("footer.privacy")}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/help"
          className="transition-colors hover:text-muted-foreground"
        >
          {t("footer.helpSupport")}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/legal/impressum"
          className="transition-colors hover:text-muted-foreground"
        >
          {t("footer.imprint")}
        </Link>
      </div>
    </footer>
  )
}

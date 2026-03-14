"use client"

import { usePathname } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { LandingHeader } from "@/components/landing-header"
import { useI18n } from "@/lib/i18n"

/** Footer mit Icons + Links auf jeder Seite außer Landing */
function shouldShowFooter(pathname: string): boolean {
  return pathname !== "/"
}

function titleForPath(pathname: string, t: (key: string, params?: Record<string, string | number>) => string) {
  if (pathname.startsWith("/sessions")) return t("sessions.title")
  if (pathname.startsWith("/projects")) return t("projects.title")
  if (pathname.startsWith("/messages")) return t("messages.title")
  if (pathname.startsWith("/ai-guide")) return t("common.aiGuide")
  if (pathname.startsWith("/profile")) return t("common.profile")
  if (pathname.startsWith("/profile/availability")) return t("globalNav.availability")
  if (pathname.startsWith("/admin")) return t("admin.title")
  if (pathname.startsWith("/legal/agb")) return t("landing.terms")
  if (pathname.startsWith("/legal/impressum")) return t("footer.imprint")
  if (pathname.startsWith("/legal/datenschutz")) return t("footer.privacy")
  if (pathname.startsWith("/how-it-works")) return t("footer.howItWorks")
  if (pathname.startsWith("/help")) return t("footer.helpSupport")
  if (pathname.startsWith("/booking")) return t("booking.title")
  if (pathname.startsWith("/session")) return t("sessions.title")
  return undefined
}

// Auth-only pages – kein App-Header, kein Avatar
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

export function GlobalNavigation() {
  const pathname = usePathname()
  const { t } = useI18n()

  if (pathname === "/") {
    return <LandingHeader />
  }

  // Auf Anmelde-/Registrierungsseiten keinen Header mit Avatar zeigen
  if (AUTH_PATHS.some((p) => pathname?.startsWith(p))) {
    return null
  }

  const title = titleForPath(pathname, t)
  const showFooter = shouldShowFooter(pathname)

  return (
    <>
      <AppHeader title={title} />
      {showFooter && <BottomNav />}
    </>
  )
}


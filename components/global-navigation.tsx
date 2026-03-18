"use client"

import { usePathname } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AuthHeader } from "@/components/auth-header"
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

// Auth-only pages – AuthHeader (Layout wie Profilseite)
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

function authTitleForPath(pathname: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (pathname.startsWith("/register")) return t("register.title")
  if (pathname.startsWith("/login")) return t("nav.login")
  if (pathname.startsWith("/forgot-password")) return t("forgot.title")
  if (pathname.startsWith("/reset-password")) return t("reset.title")
  if (pathname.startsWith("/verify-email")) return t("verify.title")
  return t("common.profile")
}

export function GlobalNavigation() {
  const pathname = usePathname()
  const { t } = useI18n()

  if (pathname === "/") {
    return <LandingHeader />
  }

  // Pay-Seiten: kein Header, kein Footer — nur Stripe
  if (pathname?.startsWith("/pay")) {
    return null
  }

  // Video-Call: Vollbild ohne Header/Footer (Bedienelemente sonst verdeckt)
  if (pathname?.startsWith("/session/")) {
    return null
  }

  // Auth-Seiten: Header im gleichen Layout wie Profilseite
  if (AUTH_PATHS.some((p) => pathname?.startsWith(p))) {
    return <AuthHeader title={authTitleForPath(pathname ?? "", t)} />
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


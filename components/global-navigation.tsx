"use client"

import { usePathname } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { LandingHeader } from "@/components/landing-header"
import { useI18n } from "@/lib/i18n"

function shouldShowBottomNav(pathname: string): boolean {
  return (
    pathname.startsWith("/home") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/ai-guide") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/sessions") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/dashboard")
  )
}

function titleForPath(pathname: string, t: (key: string, params?: Record<string, unknown>) => string) {
  if (pathname.startsWith("/sessions")) return t("sessions.title")
  if (pathname.startsWith("/projects")) return t("projects.title")
  if (pathname.startsWith("/messages")) return t("messages.title")
  if (pathname.startsWith("/profile")) return t("common.profile")
  if (pathname.startsWith("/dashboard/availability")) return t("globalNav.availability")
  if (pathname.startsWith("/admin")) return t("profile.adminDashboard")
  if (pathname.startsWith("/legal/agb")) return t("landing.terms")
  if (pathname.startsWith("/legal/impressum")) return t("footer.imprint")
  if (pathname.startsWith("/legal/datenschutz")) return t("footer.privacy")
  if (pathname.startsWith("/booking")) return t("booking.title")
  if (pathname.startsWith("/session")) return t("sessions.title")
  return undefined
}

export function GlobalNavigation() {
  const pathname = usePathname()
  const { t } = useI18n()

  if (pathname === "/") {
    return <LandingHeader />
  }

  const title = titleForPath(pathname, t)
  const showBottomNav = shouldShowBottomNav(pathname)

  return (
    <>
      <AppHeader title={title} />
      {showBottomNav && <BottomNav />}
    </>
  )
}


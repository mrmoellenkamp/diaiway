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
  if (pathname.startsWith("/dashboard/availability")) return "Meine Verfuegbarkeit"
  if (pathname.startsWith("/admin")) return "Admin"
  if (pathname.startsWith("/legal/agb")) return "AGB"
  if (pathname.startsWith("/legal/impressum")) return "Impressum"
  if (pathname.startsWith("/legal/datenschutz")) return "Datenschutz"
  if (pathname.startsWith("/booking")) return "Buchung"
  if (pathname.startsWith("/session")) return "Session"
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


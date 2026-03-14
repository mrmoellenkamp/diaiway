"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/booking", "/sessions", "/session", "/messages"]

/**
 * Verhindert, dass nach Logout/Timeout die geschützte Seite per Zurück-Button
 * aus dem BFCache (Back-Forward Cache) angezeigt wird.
 * Bei pageshow (persisted) prüfen wir die Session und redirecten bei Bedarf.
 */
export function LogoutBackGuard() {
  const pathname = usePathname()

  useEffect(() => {
    const isProtected = PROTECTED_PREFIXES.some((p) => pathname?.startsWith(p))

    const handlePageShow = (ev: PageTransitionEvent) => {
      if (!ev.persisted || !isProtected) return
      fetch("/api/auth/session", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (!data?.user) {
            window.location.replace("/login")
          }
        })
    }

    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [pathname])

  return null
}

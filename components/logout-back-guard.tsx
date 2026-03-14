"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/booking", "/sessions", "/session", "/messages"]

/**
 * Verhindert, dass nach Logout/Timeout die geschützte Seite per Zurück-Button
 * aus dem BFCache (Back-Forward Cache) angezeigt wird.
 *
 * Mechanismus 1 (BFCache): pageshow mit persisted=true → Seite kommt aus dem Cache →
 * Session-API prüfen → bei ungültiger Session zu /login weiterleiten.
 *
 * Hinweis: Mechanismus "unauthenticated status auf geschützter Seite" wurde entfernt,
 * da er mit intentionellen Redirects (Deep-Link-Login) kollidiert hat.
 * Der SessionActivityProvider übernimmt das Ausloggen bei Inaktivität selbstständig.
 */
export function LogoutBackGuard() {
  const pathname = usePathname()
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname?.startsWith(p))

  useEffect(() => {
    if (!isProtected) return

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
        const data = await res.json()
        if (!data?.user) {
          window.location.replace("/login")
        }
      } catch {
        // Bei Netzwerkfehler nichts tun
      }
    }

    // Nur BFCache-Schutz: Seite erscheint aus dem Browser-Cache (Zurück-Button)
    const handlePageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) checkSession()
    }

    window.addEventListener("pageshow", handlePageShow)
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [pathname, isProtected])

  return null
}

"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/booking", "/sessions", "/session", "/messages"]

/**
 * Verhindert, dass nach Logout/Timeout die geschützte Seite per Zurück-Button
 * (BFCache oder normaler History-Cache) angezeigt wird.
 *
 * Drei Mechanismen:
 * 1. pageshow(persisted) → BFCache-Seite erscheint → Session prüfen → redirect
 * 2. visibilitychange(visible) → Tab kommt in Vordergrund → Session prüfen
 * 3. useSession(unauthenticated) auf geschützter Seite → sofort redirect
 */
export function LogoutBackGuard() {
  const pathname = usePathname()
  const { status } = useSession()
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname?.startsWith(p))

  // Mechanismus 3: useSession meldet unauthenticated auf geschützter Seite
  useEffect(() => {
    if (!isProtected) return
    if (status === "unauthenticated") {
      window.location.replace("/login")
    }
  }, [status, isProtected])

  useEffect(() => {
    if (!isProtected) return

    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
        const data = await res.json()
        if (!data?.user) {
          await signOut({ redirect: false })
          window.location.replace("/login")
        }
      } catch {
        // Bei Netzwerkfehler nichts tun – Nutzer ist wahrscheinlich offline
      }
    }

    // Mechanismus 1: BFCache – Seite erscheint aus dem Cache
    const handlePageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) checkSession()
    }

    // Mechanismus 2: Tab wird wieder aktiv (z.B. nach Wechsel zu anderem Tab)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkSession()
    }

    window.addEventListener("pageshow", handlePageShow)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.removeEventListener("pageshow", handlePageShow)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [pathname, isProtected])

  return null
}

"use client"

import { signOut } from "next-auth/react"

function clearBrowserAuthCookies(): void {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:"
  const suffix = `path=/; max-age=0; samesite=lax${secure ? "; secure" : ""}`

  document.cookie = `authjs.session-token=; ${suffix}`
  document.cookie = `__Secure-authjs.session-token=; ${suffix}`
  document.cookie = `diaiway_stay=; ${suffix}`
}

async function signOutAndClearCookies(): Promise<void> {
  try {
    await signOut({ redirect: false })
  } catch {
    // Trotzdem Cookies leeren
  }
  clearBrowserAuthCookies()
}

/** Nur Session invalidieren + Cookies leeren, keine Navigation (z. B. /login?reason=timeout). */
export async function revokeSessionCookiesOnly(): Promise<void> {
  await signOutAndClearCookies()
}

/**
 * Zuverlässiger Client-Logout für NextAuth (JWT + Middleware-Cookies).
 *
 * - `signOut({ redirect: false })` invalidiert die Session serverseitig.
 * - Anschließend werden Session-Cookies clientseitig mit korrekten Attributen
 *   gelöscht (`__Secure-…` erfordert `Secure` in Production), sonst bleibt
 *   das Cookie in Safari/WebKit oft bestehen → Nutzer wirkt auf `/` noch
 *   angemeldet bis zum zweiten Versuch.
 * - `diaiway_stay` (kein HttpOnly) wird ebenfalls entfernt.
 */
export async function hardSignOut(redirectTo = "/"): Promise<void> {
  await signOutAndClearCookies()
  window.location.replace(redirectTo)
}

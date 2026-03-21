import { Capacitor } from "@capacitor/core"

/**
 * WebKit (Safari, alle Browser auf iOS) synchronisiert Session-Cookies mit
 * clientseitiger Next.js-Navigation (`router.replace`) oft schlechter als Chromium
 * (Chrome, Brave, Edge). Symptom: Cookie ist gesetzt, aber `useSession()` bleibt
 * „unauthenticated“ bis zu einem harten Reload.
 *
 * **Capacitor Android:** System-WebView verhält sich ähnlich: Nach `signIn` sind
 * Cookies oft erst nach einem vollen Document-Load zuverlässig für RSC/Fetch —
 * Soft-Navigation kann „leere“ Session, Redirect-Loops oder WebView-Abstürze auslösen.
 *
 * Nach Login: einmal `window.location.assign` erzwingt einen vollständigen
 * Dokumenten-Load — kein zusätzlicher Server/Kosten.
 */
export function shouldUseHardNavigationAfterLogin(): boolean {
  if (typeof navigator === "undefined") return false

  // iOS/Android App: immer harter Reload nach Login (Cookie + Next Auth Session)
  if (Capacitor.isNativePlatform()) return true

  const ua = navigator.userAgent

  // iPhone / iPad Web (Safari): immer WebKit → gleiche Thematik
  if (/iPad|iPhone|iPod/i.test(ua)) return true

  // Desktop: echtes Safari (Version/… Safari/), nicht Chrome/Edge/Firefox/Brave
  // (Chrome-UA enthält oft „Safari/537.36“, aber immer „Chrome/“.)
  if (/Chrome\/|Chromium\/|Edg\/|Firefox\/|Brave\//i.test(ua)) return false
  return /Version\/[\d.]+.*Safari\//i.test(ua)
}

/**
 * Native WebView / Safari: Set-Cookie kann kurz verzögert sein; sofortiges
 * `location.assign` kann die Session auf der Zielseite „vergessen“.
 */
export function webkitCookieSettleDelayMs(): number {
  return shouldUseHardNavigationAfterLogin() ? 280 : 0
}

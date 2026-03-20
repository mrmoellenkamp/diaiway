/**
 * WebKit (Safari, alle Browser auf iOS) synchronisiert Session-Cookies mit
 * clientseitiger Next.js-Navigation (`router.replace`) oft schlechter als Chromium
 * (Chrome, Brave, Edge). Symptom: Cookie ist gesetzt, aber `useSession()` bleibt
 * „unauthenticated“ bis zu einem harten Reload.
 *
 * Nach Login: einmal `window.location.assign` erzwingt einen vollständigen
 * Dokumenten-Load — kein zusätzlicher Server/Kosten.
 */
export function shouldUseHardNavigationAfterLogin(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent

  // iPhone / iPad: immer WebKit → gleiche Thematik wie Safari
  if (/iPad|iPhone|iPod/i.test(ua)) return true

  // Desktop: echtes Safari (Version/… Safari/), nicht Chrome/Edge/Firefox/Brave
  // (Chrome-UA enthält oft „Safari/537.36“, aber immer „Chrome/“.)
  if (/Chrome\/|Chromium\/|Edg\/|Firefox\/|Brave\//i.test(ua)) return false
  return /Version\/[\d.]+.*Safari\//i.test(ua)
}

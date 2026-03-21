/**
 * Post-Login- und callbackUrl-Handling: immer auf der **aktuellen Origin** bleiben.
 *
 * Verhindert Sprung von `http://localhost:3001` → `https://diaiway.com/...`, wenn
 * - `NEXTAUTH_URL` in .env noch auf Prod zeigt,
 * - ein Lesezeichen `?callbackUrl=https://diaiway.com/...` mitschleppt,
 * - oder Auth.js eine absolute Prod-URL in `signIn` → `url` zurückgibt.
 */

export function normalizePostLoginTarget(
  raw: string | null | undefined,
  currentOrigin: string
): string | null {
  if (raw == null) return null
  const s = raw.trim()
  if (!s || s === "/") return null

  if (s.startsWith("/")) {
    if (s.startsWith("//")) return null
    if (s.includes("..")) return null
    return s
  }

  try {
    const u = new URL(s)
    const cur = new URL(currentOrigin)
    if (u.origin === cur.origin) {
      const p = u.pathname + u.search + u.hash
      return p || "/"
    }
    // Gleiche App auf anderem Host: nur Pfad übernehmen (lokal weiterarbeiten)
    const path = u.pathname + u.search + u.hash
    if (!path.startsWith("/") || path.startsWith("//")) return null
    if (path.includes("..")) return null
    return path
  } catch {
    return null
  }
}

/** Relativer Pfad für `signIn(..., { callbackUrl })` — nie volle Prod-URL. */
export function nextAuthCallbackPath(
  raw: string | null | undefined,
  currentOrigin: string,
  fallback = "/categories"
): string {
  return normalizePostLoginTarget(raw, currentOrigin) ?? fallback
}

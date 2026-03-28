import type { AppLocale } from "./types"
import { isAppLocale } from "./types"

/**
 * Locale for API responses: query ?locale=, JSON body.locale, then diaiway-locale cookie.
 */
export function localeFromRequest(req: Request, bodyLocale?: unknown): AppLocale {
  try {
    const q = new URL(req.url).searchParams.get("locale")
    if (q && isAppLocale(q)) return q
  } catch {
    /* ignore */
  }
  if (typeof bodyLocale === "string" && isAppLocale(bodyLocale)) return bodyLocale
  const raw = req.headers.get("cookie") || ""
  const m = raw.match(/(?:^|;\s*)diaiway-locale=(de|en|es)(?:\s|;|$)/)
  if (m?.[1] && isAppLocale(m[1])) return m[1]
  return "de"
}

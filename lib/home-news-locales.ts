/**
 * Home-Newsfeed: unterstützte UI-Sprachen (mit lib/i18n AppLocale abgestimmt).
 */

export const HOME_NEWS_LOCALES = ["de", "en", "es"] as const
export type HomeNewsLocale = (typeof HOME_NEWS_LOCALES)[number]

export function isHomeNewsLocale(s: string): s is HomeNewsLocale {
  return (HOME_NEWS_LOCALES as readonly string[]).includes(s)
}

export function normalizeHomeNewsLocale(raw: string | null | undefined): HomeNewsLocale {
  if (raw && isHomeNewsLocale(raw)) return raw
  return "de"
}

export type HomeNewsTranslationBlock = {
  title: string
  body: string
  linkUrl?: string | null
  linkLabel?: string | null
}

/** Leer / fehlend → null (für DB). */
function normalizeLinkField(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== "string") return null
  const t = v.trim()
  return t === "" ? null : t
}

/** Aus API-Body: nur vollständige Blöcke (Titel + Text); Links optional pro Sprache. */
export function parseTranslationsFromBody(
  raw: unknown,
): Partial<Record<HomeNewsLocale, HomeNewsTranslationBlock>> | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const out: Partial<Record<HomeNewsLocale, HomeNewsTranslationBlock>> = {}
  for (const loc of HOME_NEWS_LOCALES) {
    const b = o[loc]
    if (!b || typeof b !== "object") continue
    const title = typeof (b as { title?: unknown }).title === "string" ? (b as { title: string }).title.trim() : ""
    const body = typeof (b as { body?: unknown }).body === "string" ? (b as { body: string }).body.trim() : ""
    if (title && body) {
      out[loc] = {
        title,
        body,
        linkUrl: normalizeLinkField((b as { linkUrl?: unknown }).linkUrl),
        linkLabel: normalizeLinkField((b as { linkLabel?: unknown }).linkLabel),
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

export function pickNewsTranslationForLocale<
  T extends { locale: string; title: string; body: string; linkUrl?: string | null; linkLabel?: string | null },
>(rows: T[], locale: HomeNewsLocale): T | null {
  const direct = rows.find((r) => r.locale === locale)
  if (direct) return direct
  const de = rows.find((r) => r.locale === "de")
  if (de) return de
  return rows[0] ?? null
}

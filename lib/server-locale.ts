import { headers } from "next/headers"
import type { AppLocale } from "@/lib/i18n/types"
import { isAppLocale } from "@/lib/i18n/types"

/**
 * Locale für Server-seitige Fehlermeldungen (Zahlung, Rechnungsdaten).
 * 1) Cookie `diaiway-locale` (vom Client gesetzt, siehe I18nProvider)
 * 2) Accept-Language
 * 3) de
 */
export async function getRequestLocale(): Promise<AppLocale> {
  const h = await headers()
  const cookieHeader = h.get("cookie") ?? ""
  const m = cookieHeader.match(/(?:^|;\s*)diaiway-locale=(de|en|es)(?:;|$)/)
  if (m?.[1] && isAppLocale(m[1])) return m[1]

  const al = (h.get("accept-language") ?? "").toLowerCase()
  const first = al.split(",")[0]?.trim().split("-")[0] ?? "de"
  if (first === "en") return "en"
  if (first === "es") return "es"
  return "de"
}

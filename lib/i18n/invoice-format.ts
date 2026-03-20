import type { AppLocale } from "@/lib/i18n/types"
import de from "./de"
import en from "./en"
import es from "./es"

const dicts: Record<AppLocale, Record<string, string>> = { de, en, es }

function t(locale: AppLocale, key: string): string {
  return dicts[locale][key] ?? dicts.de[key] ?? key
}

/** Nutzer-sichtbare Meldung: fehlende Rechnungsfelder nach Locale. */
export function formatInvoiceIncompleteMessage(locale: AppLocale, missingFieldKeys: string[]): string {
  const labels = missingFieldKeys.map((k) => t(locale, `invoice.field.${k}`))
  const list = labels.join(locale === "de" ? ", " : ", ")
  return t(locale, "invoice.error.incomplete").replace("{fields}", list)
}

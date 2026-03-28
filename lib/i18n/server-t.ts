import de from "./de"
import en from "./en"
import es from "./es"
import type { AppLocale } from "./types"
import { isAppLocale } from "./types"

const dicts: Record<AppLocale, Record<string, string>> = {
  de: de as unknown as Record<string, string>,
  en: en as unknown as Record<string, string>,
  es: es as unknown as Record<string, string>,
}

/**
 * Resolve UI strings on the server (API routes, jobs) using the same keys as the client dictionaries.
 */
export function serverT(
  locale: AppLocale | string | undefined | null,
  key: string,
  vars?: Record<string, string | number>
): string {
  const l: AppLocale = locale && isAppLocale(String(locale)) ? (String(locale) as AppLocale) : "de"
  let text = dicts[l][key] ?? dicts.de[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v))
    }
  }
  return text
}

export type AppLocale = "de" | "en" | "es"

export const APP_LOCALES: AppLocale[] = ["de", "en", "es"]

export function isAppLocale(v: string): v is AppLocale {
  return v === "de" || v === "en" || v === "es"
}

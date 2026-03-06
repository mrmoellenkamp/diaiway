"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import de from "./de"
import en from "./en"
import es from "./es"

export type Locale = "de" | "en" | "es"
type Dictionary = typeof de

const dictionaries: Record<Locale, Dictionary> = { de, en, es }

export const localeNames: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  es: "Espanol",
}

export const localeFlags: Record<Locale, string> = {
  de: "DE",
  en: "EN",
  es: "ES",
}

type I18nContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de")

  useEffect(() => {
    const stored = localStorage.getItem("diaiway-locale") as Locale | null
    if (stored && dictionaries[stored]) {
      setLocaleState(stored)
      document.documentElement.lang = stored
    }
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem("diaiway-locale", l)
    document.documentElement.lang = l
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let text = (dictionaries[locale] as Record<string, string>)[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    },
    [locale]
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}

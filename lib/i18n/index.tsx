"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import de from "./de"
import en from "./en"
import es from "./es"
import type { AppLocale } from "./types"

export type Locale = AppLocale
type Dictionary = Record<string, string>

const dictionaries: Record<Locale, Dictionary> = { de, en, es }

/** Cookie für Server-Locale (z. B. Rechnungsfehler); Secure nur auf HTTPS. */
function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:"
  document.cookie = `diaiway-locale=${locale}; path=/; max-age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`
}

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

function persistPreferredLocaleServer(l: Locale) {
  void fetch("/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferredLocale: l }),
  }).catch(() => {})
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const [locale, setLocaleState] = useState<Locale>("de")
  useEffect(() => {
    if (status !== "authenticated") {
      const stored = localStorage.getItem("diaiway-locale") as Locale | null
      if (stored && dictionaries[stored]) {
        setLocaleState(stored)
        document.documentElement.lang = stored
        setLocaleCookie(stored)
      }
      return
    }

    let cancelled = false
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { preferredLocale?: string } | null) => {
        if (cancelled || !p) return
        const pl = p.preferredLocale as Locale | null
        const stored = localStorage.getItem("diaiway-locale") as Locale | null
        // Bestehende Nutzer: nur localStorage EN/ES, DB noch Default "de" → einmal übernehmen
        if (pl === "de" && stored && stored !== "de" && dictionaries[stored]) {
          setLocaleState(stored)
          localStorage.setItem("diaiway-locale", stored)
          document.documentElement.lang = stored
          setLocaleCookie(stored)
          persistPreferredLocaleServer(stored)
          return
        }
        if (pl && dictionaries[pl]) {
          setLocaleState(pl)
          localStorage.setItem("diaiway-locale", pl)
          document.documentElement.lang = pl
          setLocaleCookie(pl)
          return
        }
        if (stored && dictionaries[stored]) {
          setLocaleState(stored)
          document.documentElement.lang = stored
          setLocaleCookie(stored)
        }
      })
      .catch(() => {
        const stored = localStorage.getItem("diaiway-locale") as Locale | null
        if (stored && dictionaries[stored]) {
          setLocaleState(stored)
          document.documentElement.lang = stored
          setLocaleCookie(stored)
        }
      })
    return () => {
      cancelled = true
    }
  }, [status])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem("diaiway-locale", l)
    document.documentElement.lang = l
    setLocaleCookie(l)
    if (status === "authenticated") persistPreferredLocaleServer(l)
  }, [status])

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

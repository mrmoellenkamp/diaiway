"use client"

import { useI18n, type Locale } from "@/lib/i18n"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { LanguageFlagSticker } from "@/components/language-flag-sticker"

const locales: Locale[] = ["de", "en", "es"]

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "landing" | "compact" }) {
  const { locale, setLocale } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation",
            variant === "landing"
              ? "px-2 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              : variant === "compact"
                ? "px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                : "px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-label="Change language"
        >
          <Globe className="size-4 shrink-0" />
          <LanguageFlagSticker lang={locale} showLabel="abbrev" size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[80px]">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLocale(l)}
            aria-label={l === "de" ? "Deutsch" : l === "en" ? "English" : "Español"}
            className={cn(
              "flex items-center gap-2 text-sm",
              l === locale && "font-semibold text-primary"
            )}
          >
            <LanguageFlagSticker lang={l} showLabel="abbrev" size="sm" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import { useI18n, localeNames, localeFlags, type Locale } from "@/lib/i18n"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"

const locales: Locale[] = ["de", "en", "es"]

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "landing" | "compact" }) {
  const { locale, setLocale } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            variant === "landing"
              ? "px-2.5 py-1.5 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              : variant === "compact"
                ? "px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                : "px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-label="Change language"
        >
          <Globe className="size-3.5" />
          <span>{localeFlags[locale]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLocale(l)}
            className={cn(
              "flex items-center gap-2 text-sm",
              l === locale && "font-semibold text-primary"
            )}
          >
            <span className="text-xs font-mono w-5">{localeFlags[l]}</span>
            <span>{localeNames[l]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

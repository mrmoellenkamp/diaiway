"use client"

import { cn } from "@/lib/utils"
import "country-flag-icons/3x2/flags.css"

/** Language code → ISO 3166-1 country code for flags */
const LANG_TO_COUNTRY: Record<string, string> = {
  de: "DE",
  en: "GB",
  es: "ES",
  fr: "FR",
  it: "IT",
}

/** Language code → full display name */
const LANG_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
}

interface LanguageFlagStickerProps {
  lang: string
  /** "code" = DE/EN, "full" = Deutsch/English, "none" = only flag */
  showLabel?: "code" | "full" | "none"
  size?: "sm" | "md"
  className?: string
}

export function LanguageFlagSticker({
  lang,
  showLabel = "code",
  size = "md",
  className,
}: LanguageFlagStickerProps) {
  const countryCode = LANG_TO_COUNTRY[lang.toLowerCase()] ?? lang.toUpperCase().slice(0, 2)
  const hasFlag = LANG_TO_COUNTRY[lang.toLowerCase()]
  const label = showLabel === "code" ? lang.toUpperCase() : showLabel === "full" ? (LANG_NAMES[lang.toLowerCase()] ?? lang) : null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/80 px-2 py-0.5 shadow-sm icon-paper",
        size === "sm" && "gap-1 px-1.5 py-0.5 text-xs",
        size === "md" && "gap-1.5 px-2 py-1 text-sm",
        className
      )}
      title={LANG_NAMES[lang.toLowerCase()] ?? lang}
    >
      {hasFlag ? (
        <span
          className={cn(
            "inline-block flex-shrink-0 overflow-hidden rounded-[0.2rem] bg-muted/30",
            size === "sm" && "text-[0.875rem]",
            size === "md" && "text-base"
          )}
          aria-hidden
        >
          <span className={`flag:${countryCode}`} />
        </span>
      ) : (
        <span className="flex size-4 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground" aria-hidden>
          {countryCode.slice(0, 1)}
        </span>
      )}
      {label && (
        <span className="font-medium text-inherit">
          {label}
        </span>
      )}
    </span>
  )
}

export { LANG_TO_COUNTRY, LANG_NAMES }

"use client"

import { cn } from "@/lib/utils"
import DE from "country-flag-icons/react/3x2/DE"
import ES from "country-flag-icons/react/3x2/ES"
import GB from "country-flag-icons/react/3x2/GB"
import FR from "country-flag-icons/react/3x2/FR"
import IT from "country-flag-icons/react/3x2/IT"

/** Language code → ISO 3166-1 country code for flags */
const LANG_TO_COUNTRY: Record<string, string> = {
  de: "DE",
  en: "GB",
  es: "ES",
  fr: "FR",
  it: "IT",
}

/** Inline-SVG statt CSS-Background für zuverlässige Darstellung auf iOS */
const FLAG_COMPONENTS: Record<string, React.ComponentType<{ className?: string; title?: string }> | undefined> = {
  DE,
  GB,
  ES,
  FR,
  IT,
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
  /** "code" = DE/EN, "full" = Deutsch/English, "none" = only flag, "abbrev" = nur Länderkürzel (DE/EN/ES) ohne Flag, ohne Rahmen */
  showLabel?: "code" | "full" | "none" | "abbrev"
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
  const label = showLabel === "code" || showLabel === "abbrev" ? lang.toUpperCase() : showLabel === "full" ? (LANG_NAMES[lang.toLowerCase()] ?? lang) : null

  if (showLabel === "abbrev") {
    return (
      <span
        className={cn(
          "inline-flex items-center font-medium text-inherit",
          size === "sm" && "text-xs",
          size === "md" && "text-sm",
          className
        )}
        title={LANG_NAMES[lang.toLowerCase()] ?? lang}
      >
        {lang.toUpperCase()}
      </span>
    )
  }

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
        (() => {
          const FlagSvg = FLAG_COMPONENTS[countryCode]
          return FlagSvg ? (
            <span
              className={cn(
                "inline-block flex-shrink-0 overflow-hidden rounded-[0.2rem]",
                size === "sm" && "size-[0.875rem]",
                size === "md" && "size-4"
              )}
              aria-hidden
            >
              <FlagSvg className="size-full object-cover" title={LANG_NAMES[lang.toLowerCase()]} />
            </span>
          ) : (
            <span className="flex size-4 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground" aria-hidden>
              {countryCode.slice(0, 1)}
            </span>
          )
        })()
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

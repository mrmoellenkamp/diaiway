"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { LanguageFlagSticker } from "@/components/language-flag-sticker"
import { cn } from "@/lib/utils"

/**
 * Rolle (Takumi/Shugyo) + optionale Admin-Markierung + Sprachfahnen — gleiches Muster wie
 * `/profile` und `/takumi/[id]`, damit die Profilvorschau nicht abweicht und wir JSX nicht dreifach pflegen.
 */
export function ProfileRoleAndLanguages({
  variant,
  languages,
  isAdmin,
  trailing,
  className,
}: {
  variant: "takumi" | "shugyo"
  languages: string[]
  isAdmin?: boolean
  /** z. B. PRO + LiveBadge bei Takumi */
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mt-1 flex flex-col items-center gap-2", className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge
          variant="outline"
          className="border-[rgba(6,78,59,0.3)] bg-[rgba(6,78,59,0.05)] text-primary text-[10px]"
        >
          {variant === "takumi" ? (
            <>
              Takumi <span className="font-jp ml-0.5">匠</span>
            </>
          ) : (
            <>
              Shugyo <span className="font-jp ml-0.5">修行</span>
            </>
          )}
        </Badge>
        {trailing}
        {isAdmin && (
          <Badge variant="outline" className="border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] text-destructive text-[10px]">
            Admin
          </Badge>
        )}
      </div>
      {languages.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {languages.map((lang) => (
            <LanguageFlagSticker key={lang} lang={lang} showLabel="flagOnly" size="sm" />
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { MentorChat } from "@/components/mentor-chat"
import { DiAiwayBrand } from "@/components/diaiway-brand"
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

function OnlinePill({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.1)] px-2 py-0.5 text-[9px] font-semibold text-accent",
        className
      )}
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-accent" />
        <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
      </span>
      {t("mentor.online")}
    </span>
  )
}

interface CollapsibleAiBoxProps {
  /** Start expanded (categories: false, home: false) */
  defaultExpanded?: boolean
  /** Variant for MentorChat */
  chatVariant?: "embedded" | "fullpage"
  /** Optional compact header for home */
  compact?: boolean
  /** Use primary background for header (home) vs card (categories) */
  variant?: "primary" | "card"
  /** Optional title override */
  title?: string
  /** Optional description override */
  description?: string
  className?: string
}

export function CollapsibleAiBox({
  defaultExpanded = false,
  chatVariant = "embedded",
  compact = false,
  variant = "primary",
  title,
  description,
  className,
}: CollapsibleAiBoxProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(defaultExpanded)

  const useBrand = !title
  const displayDesc = description ?? t("home.aiGuideDesc")
  const isPrimary = variant === "primary"

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl shadow-lg transition-shadow hover:shadow-xl",
        isPrimary
          ? "border border-[rgba(6,78,59,0.2)] bg-gradient-to-br from-primary via-primary to-[rgba(6,78,59,0.95)] shadow-[0_8px_30px_rgba(6,78,59,0.22)]"
          : "border border-border bg-card shadow-md",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "flex w-full items-center gap-3 p-4 text-left transition-colors",
          compact ? "py-3" : "py-4",
          isPrimary ? "hover:bg-[rgba(255,255,255,0.05)]" : "hover:bg-[rgba(245,245,244,0.5)]"
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            isPrimary ? "bg-[rgba(255,255,255,0.15)] ring-1 ring-[rgba(255,255,255,0.1)]" : "bg-[rgba(6,78,59,0.1)]"
          )}
        >
          <Sparkles className={cn("size-5", isPrimary ? "text-accent" : "text-primary")} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              "block text-sm font-bold leading-tight",
              isPrimary ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {useBrand ? (
              <span className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <span className="font-semibold">{t("mentor.hishoName")}</span>
                <span className={cn("opacity-70", isPrimary ? "text-primary-foreground" : "text-muted-foreground")}>
                  –
                </span>
                <DiAiwayBrand lightOnDark={isPrimary} />
                <span className={cn("opacity-70", isPrimary ? "text-primary-foreground" : "text-muted-foreground")}>
                  –
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold tracking-tight",
                    isPrimary ? "text-[rgba(240,253,244,0.95)]" : "text-[rgba(28,25,23,0.9)]"
                  )}
                >
                  {t("mentor.intelligenceSuffix")}
                </span>
              </span>
            ) : (
              title
            )}
          </span>
          <span
            className={cn(
              "mt-0.5 block text-xs leading-snug",
              isPrimary ? "text-[rgba(240,253,244,0.65)]" : "text-muted-foreground"
            )}
          >
            {displayDesc}
          </span>
        </div>
        {isPrimary && <OnlinePill className="hidden sm:flex" />}
        {expanded ? (
          <ChevronUp
            className={cn("size-5 shrink-0", isPrimary ? "text-[rgba(240,253,244,0.8)]" : "text-muted-foreground")}
          />
        ) : (
          <ChevronDown
            className={cn("size-5 shrink-0", isPrimary ? "text-[rgba(240,253,244,0.8)]" : "text-muted-foreground")}
          />
        )}
      </button>
      {expanded && (
        <div className="border-t border-[rgba(255,255,255,0.1)] bg-[rgba(236,253,245,0.4)]">
          <MentorChat
            variant={chatVariant}
            hideHeader
            className={cn(
              "rounded-none border-0 shadow-none",
              chatVariant === "fullpage" ? "min-h-[320px]" : undefined
            )}
          />
        </div>
      )}
    </div>
  )
}

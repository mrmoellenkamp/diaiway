"use client"

import { useState } from "react"
import { MentorChat } from "@/components/mentor-chat"
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

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

  const displayTitle = title ?? t("common.aiGuide")
  const displayDesc = description ?? t("home.aiGuideDesc")
  const isPrimary = variant === "primary"

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl shadow-xl transition-shadow hover:shadow-md",
        isPrimary ? "border border-primary/10 bg-primary" : "border border-border bg-card",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "flex w-full items-center gap-3 p-4 text-left transition-colors",
          compact ? "py-3" : "py-4",
          isPrimary ? "hover:opacity-95" : "hover:bg-muted/50"
        )}
      >
        <div className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          isPrimary ? "bg-accent/20" : "bg-primary/10"
        )}>
          <Sparkles className={cn("size-5", isPrimary ? "text-accent" : "text-primary")} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <span className={cn(
            "text-sm font-semibold",
            isPrimary ? "text-primary-foreground" : "text-foreground"
          )}>
            {displayTitle}
          </span>
          <span className={cn(
            "ml-1.5 block text-xs",
            isPrimary ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {displayDesc}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className={cn("size-4 shrink-0", isPrimary ? "text-primary-foreground/50" : "text-muted-foreground")} />
        ) : (
          <ChevronDown className={cn("size-4 shrink-0", isPrimary ? "text-primary-foreground/50" : "text-muted-foreground")} />
        )}
      </button>
      {expanded && (
        <div className="border-t border-primary/10">
          <MentorChat
            variant={chatVariant}
            className={chatVariant === "fullpage" ? "min-h-[320px]" : undefined}
          />
        </div>
      )}
    </div>
  )
}

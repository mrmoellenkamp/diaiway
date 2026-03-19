"use client"

import { BadgeCheck } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useI18n } from "@/lib/i18n"

interface VerifiedBadgeProps {
  className?: string
  size?: "sm" | "md"
}

export function VerifiedBadge({ className = "", size = "sm" }: VerifiedBadgeProps) {
  const { t } = useI18n()
  const iconSize = size === "sm" ? "size-3.5" : "size-4"
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center text-primary ${className}`}
            aria-label={t("takumiPage.verified")}
          >
            <BadgeCheck className={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t("takumiPage.verified")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

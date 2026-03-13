"use client"

import { BadgeCheck } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface VerifiedBadgeProps {
  className?: string
  size?: "sm" | "md"
}

export function VerifiedBadge({ className = "", size = "sm" }: VerifiedBadgeProps) {
  const iconSize = size === "sm" ? "size-3.5" : "size-4"
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center text-primary ${className}`}
            aria-label="Verifiziert"
          >
            <BadgeCheck className={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Verifiziert</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

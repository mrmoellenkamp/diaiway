"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

export function ReviewStars({
  rating,
  max = 5,
  size = "sm",
  interactive = false,
  onRate,
}: {
  rating: number
  max?: number
  size?: "sm" | "md" | "lg"
  interactive?: boolean
  onRate?: (r: number) => void
}) {
  const { t } = useI18n()
  const sizeClass = size === "sm" ? "size-3.5" : size === "md" ? "size-5" : "size-7"

  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={t("review.starsAria", { rating: String(rating), max: String(max) })}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.round(rating)
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(i + 1)}
            className={cn(
              "transition-transform",
              interactive && "cursor-pointer hover:scale-125",
              !interactive && "cursor-default"
            )}
          >
            <Star
              className={cn(
                sizeClass,
                filled ? "fill-amber text-amber" : "fill-none text-border"
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

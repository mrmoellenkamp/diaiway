"use client"

import Image from "next/image"
import { ReviewStars } from "@/components/review-stars"
import { cn } from "@/lib/utils"

type ReviewerRole = "shugyo" | "takumi"

export interface ReviewCardProps {
  rating: number
  text?: string
  createdAt: string
  reviewerName: string
  reviewerImage?: string
  reviewerAvatar?: string
  reviewerRole: ReviewerRole
}

export function ReviewCard({
  rating,
  text,
  createdAt,
  reviewerName,
  reviewerImage,
  reviewerAvatar,
  reviewerRole,
}: ReviewCardProps) {
  const initial = reviewerAvatar && reviewerAvatar.length <= 3
    ? reviewerAvatar
    : reviewerName.charAt(0).toUpperCase()

  return (
    <div className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 shrink-0 rounded-full overflow-hidden bg-[rgba(6,78,59,0.1)] flex items-center justify-center">
            {reviewerImage ? (
              <Image
                src={reviewerImage}
                alt={reviewerName}
                width={28}
                height={28}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-primary">{initial}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-foreground truncate">{reviewerName}</span>
            <span
              className={cn(
                "text-[10px] font-medium",
                reviewerRole === "takumi" ? "text-[rgba(6,78,59,0.7)]" : "text-[rgba(34,197,94,0.7)]"
              )}
            >
              {reviewerRole === "takumi" ? "匠 Takumi" : "修 Shugyo"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ReviewStars rating={rating} size="sm" />
          <span className="text-[10px] text-muted-foreground">
            {new Date(createdAt).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
          </span>
        </div>
      </div>
      {text && (
        <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
      )}
    </div>
  )
}

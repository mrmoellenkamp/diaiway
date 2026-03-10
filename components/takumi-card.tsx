"use client"

import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { LiveBadge } from "@/components/live-badge"
import { ReviewStars } from "@/components/review-stars"
import { CheckCircle } from "lucide-react"
import { FavoriteButton } from "@/components/favorite-button"
import { InstantCallTrigger } from "@/components/instant-call-trigger"
import type { Takumi } from "@/lib/types"

export function TakumiCard({ takumi }: { takumi: Takumi }) {
  return (
    <Link href={`/takumi/${takumi.id}`} className="block">
      <Card className="gap-0 overflow-hidden border-border/60 py-0 transition-shadow hover:shadow-md">
        <CardContent className="relative flex items-start gap-3 p-4">
          <FavoriteButton takumiId={takumi.id} className="absolute top-3 right-3 z-10" />
          <div className="relative shrink-0">
            <Avatar className="size-14 border-2 border-primary/10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {takumi.avatar}
              </AvatarFallback>
            </Avatar>
            {takumi.isLive && (
              <span className="absolute -bottom-1 -right-1">
                <LiveBadge />
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-foreground">
                {takumi.name}
              </span>
              {takumi.verified && (
                <CheckCircle className="size-3.5 shrink-0 text-accent" />
              )}
              {takumi.isPro && (
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-none">
                  PRO
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {takumi.categoryName} &middot; {takumi.subcategory}
            </p>
            <div className="flex items-center gap-2">
              <ReviewStars rating={takumi.rating} />
              <span className="text-xs text-muted-foreground">
                {takumi.rating} ({takumi.reviewCount})
              </span>
            </div>
            <div className="flex flex-col gap-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {takumi.responseTime}
                </span>
                <span className="text-sm font-semibold text-primary">
                  ab {(takumi.priceVoice15Min ?? takumi.pricePerSession ? (takumi.pricePerSession ?? 0) / 2 : 0).toFixed(0)} € / 15 Min
                </span>
              </div>
              {takumi.liveStatus === "available" && (
                <InstantCallTrigger takumi={takumi} variant="card" className="w-full mt-0.5" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function TakumiCardCompact({ takumi }: { takumi: Takumi }) {
  return (
    <Link href={`/takumi/${takumi.id}`} className="block">
      <div className="relative flex w-32 shrink-0 flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-3 transition-shadow hover:shadow-md">
        <FavoriteButton takumiId={takumi.id} size="sm" className="absolute top-2 right-2 z-10 size-7" />
        <div className="relative">
          <Avatar className="size-16 border-2 border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {takumi.avatar}
            </AvatarFallback>
          </Avatar>
          {takumi.isLive && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2">
              <LiveBadge />
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="text-xs font-semibold text-foreground truncate w-full">
            {takumi.name}
          </span>
          <span className="text-[10px] text-muted-foreground truncate w-full">
            {takumi.subcategory}
          </span>
          <div className="flex items-center gap-0.5">
            <ReviewStars rating={takumi.rating} />
          </div>
        </div>
      </div>
    </Link>
  )
}

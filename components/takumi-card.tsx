"use client"

import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { LiveBadge } from "@/components/live-badge"
import { ReviewStars } from "@/components/review-stars"
import { VerifiedBadge } from "@/components/verified-badge"
import { FavoriteButton } from "@/components/favorite-button"
import { InstantCallTrigger } from "@/components/instant-call-trigger"
import type { Takumi } from "@/lib/types"
import { takumiPublicLabel } from "@/lib/communication-display"

export function TakumiCard({ takumi, priority }: { takumi: Takumi; priority?: boolean }) {
  const publicName = takumiPublicLabel(takumi)
  return (
    <Link href={`/takumi/${takumi.id}`} className="block">
      <Card className="gap-0 overflow-hidden border-[rgba(231,229,227,0.6)] py-0 transition-shadow hover:shadow-md">
        <CardContent className="relative flex items-start gap-3 p-4">
          <FavoriteButton takumiId={takumi.id} className="absolute top-3 right-3 z-10" />
          <div className="relative shrink-0">
            <Avatar className="size-14 border-2 border-[rgba(6,78,59,0.1)]">
              {takumi.imageUrl ? (
                <span className="relative block size-full">
                  <Image
                    src={takumi.imageUrl}
                    alt={publicName}
                    fill
                    className="object-cover"
                    sizes="56px"
                    quality={priority ? 85 : 75}
                    priority={priority}
                  />
                </span>
              ) : null}
              <AvatarFallback className="bg-[rgba(6,78,59,0.1)] text-primary font-semibold text-sm">
                {takumi.avatar}
              </AvatarFallback>
            </Avatar>
            {takumi.isLive && (
              <span className="absolute -bottom-1 -right-1">
                <LiveBadge />
              </span>
            )}
            {takumi.liveStatus === "available" && (
              <span className="absolute -top-0.5 -right-0.5">
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-[rgba(34,197,94,0.2)] text-accent border-[rgba(34,197,94,0.4)]">
                  Instant
                </Badge>
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-semibold text-foreground">
                {publicName}
              </span>
              {takumi.verified && <VerifiedBadge size="sm" className="shrink-0" />}
              {takumi.isPro && (
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 bg-[rgba(6,78,59,0.1)] text-primary border-none">
                  PRO
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {takumi.categoryName} &middot; {takumi.subcategory}
              {(takumi.allSpecialties?.length ?? 0) > 1
                ? ` · +${(takumi.allSpecialties!.length - 1)}`
                : ""}
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

export function TakumiCardCompact({ takumi, priority }: { takumi: Takumi; priority?: boolean }) {
  const offersInstant = takumi.liveStatus === "available"
  const publicName = takumiPublicLabel(takumi)
  return (
    <Link href={`/takumi/${takumi.id}`} className="block">
      <div className="relative flex w-32 shrink-0 flex-col items-center gap-2 rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-3 transition-shadow hover:shadow-md">
        <FavoriteButton takumiId={takumi.id} size="sm" className="absolute top-2 right-2 z-10 min-h-[44px] min-w-[44px]" />
        <div className="relative">
          <Avatar className="size-16 border-2 border-[rgba(6,78,59,0.1)]">
            {takumi.imageUrl ? (
              <span className="relative block size-full">
                <Image
                  src={takumi.imageUrl}
                  alt={publicName}
                  fill
                  className="object-cover"
                  sizes="64px"
                  quality={priority ? 85 : 75}
                  priority={priority}
                />
              </span>
            ) : null}
            <AvatarFallback className="bg-[rgba(6,78,59,0.1)] text-primary font-bold">
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
            {publicName}
          </span>
          <span className="text-[10px] text-muted-foreground truncate w-full">
            {takumi.subcategory}
            {(takumi.allSpecialties?.length ?? 0) > 1 ? ` +${takumi.allSpecialties!.length - 1}` : ""}
          </span>
          <div className="flex items-center gap-0.5">
            <ReviewStars rating={takumi.rating} />
          </div>
          {offersInstant && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-[rgba(34,197,94,0.2)] text-accent border-[rgba(34,197,94,0.4)]">
              Instant
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton mit exakter Geometrie der TakumiCard – für CLS-Stabilität während des Ladens */
export function TakumiCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden border-[rgba(231,229,227,0.6)] py-0">
      <CardContent className="relative flex items-start gap-3 p-4">
        <div className="absolute top-3 right-3 z-10 size-6" aria-hidden />
        <div className="relative shrink-0">
          <Skeleton className="size-14 rounded-full shrink-0" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <Skeleton className="h-3 w-48 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

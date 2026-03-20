"use client"

import { PageContainer } from "@/components/page-container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { TakumiCardSkeleton } from "@/components/takumi-card-skeleton"
import type { Category } from "@/lib/types"

interface CategoryDetailSkeletonProps {
  slug: string
  category: Category
}

/** Skeleton während Server-Daten streamt – verhindert Layout-Shift (CLS) */
export function CategoryDetailSkeleton({ slug: _slug, category }: CategoryDetailSkeletonProps) {
  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/categories">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{category.name}</h1>
            <p className="text-xs text-muted-foreground">{category.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {category.subcategories.map((sub) => (
            <Badge key={sub} variant="outline" className="text-xs">
              {sub}
            </Badge>
          ))}
        </div>

        <div>
          <Skeleton className="mb-3 h-4 w-48 rounded" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <TakumiCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

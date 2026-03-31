"use client"

import Link from "next/link"
import { useTakumis } from "@/hooks/use-takumis"
import { useI18n } from "@/lib/i18n"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Heart, Loader2 } from "lucide-react"
import { takumiPublicLabel } from "@/lib/communication-display"

interface ProfileFavoritesSectionProps {
  favoriteIds: string[]
}

/** Lädt Takumis nur wenn Favoriten vorhanden – spart Request bei Nutzern ohne Favoriten. */
export function ProfileFavoritesSection({ favoriteIds }: ProfileFavoritesSectionProps) {
  const { t } = useI18n()
  const { takumis, isLoading } = useTakumis()
  const favoriteTakumis = takumis.filter((takumi) => favoriteIds.includes(takumi.id))

  if (favoriteIds.length === 0) return null

  return (
    <Card className="border-[rgba(231,229,227,0.6)] gap-0 py-0">
      <CardContent className="flex flex-col gap-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Heart className="size-4 text-destructive" />
          {t("profile.favoriteTakumis")}
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {favoriteTakumis.map((takumi) => (
              <Link
                key={takumi.id}
                href={`/takumi/${takumi.id}`}
                className="flex items-center gap-3 rounded-lg border border-[rgba(231,229,227,0.4)] p-3 transition-colors hover:bg-[rgba(245,245,244,0.5)]"
              >
                <Avatar className="size-10 border-2 border-[rgba(6,78,59,0.1)]">
                  {takumi.imageUrl && <AvatarImage src={takumi.imageUrl} alt={takumiPublicLabel(takumi)} className="object-cover" />}
                  <AvatarFallback className="bg-[rgba(6,78,59,0.1)] text-primary text-xs font-bold">
                    {takumi.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">{takumiPublicLabel(takumi)}</span>
                  <span className="text-[11px] text-muted-foreground">{takumi.subcategory}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{takumi.rating} / 5</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

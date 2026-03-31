"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFavorites } from "@/hooks/use-favorites"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n"

interface FavoriteButtonProps {
  takumiId: string
  className?: string
  size?: "sm" | "md"
}

export function FavoriteButton({ takumiId, className, size = "sm" }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites()
  const { t } = useI18n()
  const [isAnimating, setIsAnimating] = useState(false)
  const router = useRouter()
  const isFav = isFavorite(takumiId)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      toast.info(t("favorites.loginRequired"))
      router.push("/login")
      return
    }

    setIsAnimating(true)
    const added = await toggleFavorite(takumiId)

    import("@/lib/native-utils").then(({ hapticLight }) => hapticLight())

    if (added === true) {
      toast.success(t("favorites.added"))
    } else if (added === false) {
      toast.success(t("favorites.removed"))
    }

    setTimeout(() => setIsAnimating(false), 300)
  }

  const iconSize = size === "sm" ? "size-4" : "size-5"

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center justify-center rounded-full transition-all",
        size === "sm" ? "size-11 min-h-11 min-w-11" : "size-11 min-h-11 min-w-11",
        isFav
          ? "bg-[rgba(239,68,68,0.1)] text-destructive"
          : "bg-[rgba(250,250,249,0.8)] text-muted-foreground hover:text-destructive hover:bg-[rgba(239,68,68,0.1)]",
        isAnimating && "scale-125",
        className
      )}
      aria-label={isFav ? t("favorites.ariaRemove") : t("favorites.ariaAdd")}
    >
      <Heart
        className={cn(
          iconSize,
          "transition-all",
          isFav && "fill-current",
          isAnimating && "scale-110"
        )}
      />
    </button>
  )
}

"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFavorites } from "@/hooks/use-favorites"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface FavoriteButtonProps {
  takumiId: string
  className?: string
  size?: "sm" | "md"
}

export function FavoriteButton({ takumiId, className, size = "sm" }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isLoggedIn } = useFavorites()
  const [isAnimating, setIsAnimating] = useState(false)
  const router = useRouter()
  const isFav = isFavorite(takumiId)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      toast.info("Bitte melde dich an, um Favoriten zu speichern.")
      router.push("/login")
      return
    }

    setIsAnimating(true)
    const added = await toggleFavorite(takumiId)

    if (added === true) {
      toast.success("Zu Favoriten hinzugefuegt!")
    } else if (added === false) {
      toast.success("Aus Favoriten entfernt.")
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
          ? "bg-destructive/10 text-destructive"
          : "bg-background/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
        isAnimating && "scale-125",
        className
      )}
      aria-label={isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufuegen"}
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

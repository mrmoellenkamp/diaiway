"use client"

import useSWR from "swr"
import { useSession } from "next-auth/react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function useFavorites() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user

  const { data, mutate } = useSWR(
    isLoggedIn ? "/api/user/favorites" : null,
    fetcher,
    { fallbackData: { favorites: [] }, revalidateOnFocus: false }
  )

  const favorites: string[] = data?.favorites || []

  async function toggleFavorite(takumiId: string) {
    if (!isLoggedIn) return false

    // Optimistic update
    const isFav = favorites.includes(takumiId)
    const optimistic = isFav
      ? favorites.filter((id) => id !== takumiId)
      : [...favorites, takumiId]

    mutate({ favorites: optimistic }, false)

    try {
      const res = await fetch("/api/user/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takumiId }),
      })
      const result = await res.json()
      mutate({ favorites: result.favorites || optimistic })
      return result.added
    } catch {
      mutate({ favorites }) // rollback
      return null
    }
  }

  function isFavorite(takumiId: string) {
    return favorites.includes(takumiId)
  }

  return { favorites, toggleFavorite, isFavorite, isLoggedIn }
}

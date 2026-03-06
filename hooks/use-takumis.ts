import useSWR from "swr"
import type { Takumi } from "@/lib/types"

const fetcher = async (url: string): Promise<Takumi[]> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Fehler beim Laden der Experten")
  return res.json()
}

/**
 * SWR hook to load Takumis from MongoDB.
 * Returns an empty array if the DB has no entries yet.
 */
export function useTakumis() {
  const { data, error, isLoading, mutate } = useSWR<Takumi[]>(
    "/api/takumis",
    fetcher,
    {
      revalidateOnFocus: false,
      errorRetryCount: 2,
      dedupingInterval: 30000,
    }
  )

  const takumis = data ?? []
  const isEmpty = !isLoading && takumis.length === 0

  return { takumis, isEmpty, isLoading, error, mutate }
}

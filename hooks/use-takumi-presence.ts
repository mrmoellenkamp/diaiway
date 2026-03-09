"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

const PRESENCE_INTERVAL_MS = 2 * 60 * 1000 // 2 Minuten

/**
 * Sendet Präsenz-Heartbeat, solange der Takumi die App offen hat.
 * Aktualisiert lastSeenAt → Anzeige "online" nur wenn tatsächlich aktiv.
 */
export function useTakumiPresence() {
  const { data: session, status } = useSession()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const appRole = (session?.user as { appRole?: string })?.appRole
    if (status !== "authenticated" || appRole !== "takumi") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const tick = () => {
      fetch("/api/takumi/presence", { method: "POST", credentials: "include" }).catch(
        () => {}
      )
    }

    tick()
    intervalRef.current = setInterval(tick, PRESENCE_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [session, status])
}

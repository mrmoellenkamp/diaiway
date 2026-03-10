"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000 // 2 Minuten
const FETCH_INTERVAL_MS = 2 * 60 * 1000

/**
 * Sendet Präsenz-Heartbeat nur wenn liveStatus === 'available'.
 * Aktualisiert lastSeenAt → Anzeige "online" nur wenn tatsächlich aktiv.
 * Bei Tab-Schließung: setzt liveStatus auf offline (sendBeacon).
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

    const tick = async () => {
      try {
        const res = await fetch("/api/expert/me", { credentials: "include" })
        const data = await res.json()
        if (data?.expert?.liveStatus === "available") {
          await fetch("/api/expert/heartbeat", { method: "POST", credentials: "include" })
        }
      } catch {
        /* ignore */
      }
    }

    tick()
    intervalRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS)

    const handleBeforeUnload = () => {
      fetch("/api/expert/live-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveStatus: "offline" }),
        keepalive: true,
      }).catch(() => {})
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [session, status])
}

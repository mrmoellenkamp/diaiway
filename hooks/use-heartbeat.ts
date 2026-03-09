"use client"

import { useEffect, useRef } from "react"
import { HEARTBEAT_INTERVAL_MS } from "@/lib/session-activity"

/**
 * Sends a heartbeat to /api/auth/heartbeat every 2 minutes while isCallActive.
 * Prevents inactivity lockout during video/audio consultations.
 */
export function useHeartbeat(isCallActive: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isCallActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const tick = () => {
      fetch("/api/auth/heartbeat", { credentials: "include" }).catch(() => {
        // Silent fail — next navigation will hit middleware
      })
    }

    tick() // immediate first heartbeat
    intervalRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isCallActive])
}

"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import {
  startQuickActionPushListener,
  registerBookingRequestChannel,
} from "@/lib/quick-action-push-handler"

/**
 * Handles Quick Action push notifications (ACCEPT/DECLINE) for Instant Connect.
 * - ACCEPT: Calls instant-accept API, then navigates to session with connecting=1
 * - DECLINE: Calls instant-decline, navigates to sessions
 */
export function QuickActionPushProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleAction = useCallback(
    async (params: { bookingId: string; statusToken: string; action: "ACCEPT" | "DECLINE" }) => {
      const { bookingId, statusToken, action } = params

      if (action === "ACCEPT") {
        try {
          const res = await fetch("/api/bookings/instant-accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, token: statusToken }),
            credentials: "include",
          })
          const data = (await res.json()) as { success?: boolean; error?: string }
          if (data.success) {
            router.push(`/session/${bookingId}?connecting=1`)
          } else {
            router.push("/sessions")
          }
        } catch {
          router.push(`/session/${bookingId}?connecting=1`)
        }
      } else {
        try {
          await fetch("/api/bookings/instant-decline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, token: statusToken }),
            credentials: "include",
          })
        } catch {
          /* ignore */
        }
        router.push("/sessions")
      }
    },
    [router]
  )

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    registerBookingRequestChannel()
    const remove = startQuickActionPushListener(handleAction)
    return remove
  }, [handleAction])

  return <>{children}</>
}

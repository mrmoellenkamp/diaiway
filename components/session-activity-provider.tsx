"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  INACTIVITY_TIMEOUT_SEC,
  INACTIVITY_WARNING_SEC,
} from "@/lib/session-activity"

type SessionActivityContextValue = {
  showWarning: boolean
  secondsLeft: number
  resetActivity: () => void
}

const SessionActivityContext = createContext<SessionActivityContextValue | null>(
  null
)

const COUNTDOWN_INTERVAL_MS = 1000
const WARNING_THRESHOLD = INACTIVITY_TIMEOUT_SEC - INACTIVITY_WARNING_SEC // 14 min

export function SessionActivityProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [secondsLeft, setSecondsLeft] = useState(INACTIVITY_TIMEOUT_SEC)
  const [showWarning, setShowWarning] = useState(false)
  const resetAtRef = useRef(Date.now())

  const resetActivity = useCallback(() => {
    resetAtRef.current = Date.now()
    setSecondsLeft(INACTIVITY_TIMEOUT_SEC)
    setShowWarning(false)
    fetch("/api/auth/heartbeat", { credentials: "include" }).catch(() => {})
  }, [])

  // Reset countdown on route change (navigation = activity)
  useEffect(() => {
    if (status === "authenticated") {
      resetAtRef.current = Date.now()
      setSecondsLeft(INACTIVITY_TIMEOUT_SEC)
      setShowWarning(false)
    }
  }, [pathname, status])

  // Countdown for authenticated users
  useEffect(() => {
    if (status !== "authenticated") return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - resetAtRef.current) / 1000)
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_SEC - elapsed)
      setSecondsLeft(remaining)

      if (remaining <= INACTIVITY_WARNING_SEC && remaining > 0) {
        setShowWarning(true)
      } else if (remaining <= 0) {
        setShowWarning(false)
        // Tatsächliches Ausloggen – Session invalidiert, replace verhindert Zurück-Button zu geschützter Seite
        signOut({ redirect: false }).finally(() => {
          window.location.replace("/login?reason=timeout")
        })
      }
    }, COUNTDOWN_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [status])

  const value: SessionActivityContextValue = {
    showWarning,
    secondsLeft,
    resetActivity,
  }

  return (
    <SessionActivityContext.Provider value={value}>
      {children}
    </SessionActivityContext.Provider>
  )
}

export function useSessionActivity() {
  const ctx = useContext(SessionActivityContext)
  if (!ctx)
    throw new Error(
      "useSessionActivity must be used within SessionActivityProvider"
    )
  return ctx
}

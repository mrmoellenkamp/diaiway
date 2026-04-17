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
import { useSession } from "next-auth/react"
import { hardSignOut } from "@/lib/hard-sign-out-client"
import {
  INACTIVITY_TIMEOUT_SEC,
  INACTIVITY_WARNING_SEC,
} from "@/lib/session-activity"

type SessionActivityContextValue = {
  showWarning: boolean
  secondsLeft: number
  resetActivity: () => void
  /** Während Video-/Audio-Call: Inaktivitäts-Logout und Warn-Countdown aussetzen */
  setCallActive: (active: boolean) => void
}

const SessionActivityContext = createContext<SessionActivityContextValue | null>(
  null
)

const COUNTDOWN_INTERVAL_MS = 1000

export function SessionActivityProvider({ children }: { children: ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()
  const [secondsLeft, setSecondsLeft] = useState(INACTIVITY_TIMEOUT_SEC)
  const [showWarning, setShowWarning] = useState(false)
  const resetAtRef = useRef(Date.now())
  const callActiveRef = useRef(false)
  /** Letzter pathname, für den wir den Inaktivitäts-Timer gesetzt haben (nicht bei jedem Session-Refetch). */
  const lastResetPathnameRef = useRef<string>("")

  const setCallActive = useCallback((active: boolean) => {
    callActiveRef.current = active
    resetAtRef.current = Date.now()
    setSecondsLeft(INACTIVITY_TIMEOUT_SEC)
    setShowWarning(false)
  }, [])

  const resetActivity = useCallback(() => {
    resetAtRef.current = Date.now()
    setSecondsLeft(INACTIVITY_TIMEOUT_SEC)
    setShowWarning(false)
    fetch("/api/auth/heartbeat", { credentials: "include" }).catch(() => {})
  }, [])

  // Nur bei echter Navigation den Timer zurücksetzen — nicht bei jedem
  // useSession()-Wechsel loading → authenticated (z. B. refetchOnWindowFocus),
  // sonst läuft die automatische Abmeldung faktisch nie ab.
  // Bei `unauthenticated` Ref leeren, damit nach erneutem Login auf derselben
  // URL der Timer wieder startet.
  useEffect(() => {
    if (status === "unauthenticated") {
      lastResetPathnameRef.current = ""
      return
    }
    if (status !== "authenticated") return
    if (lastResetPathnameRef.current === pathname) return
    lastResetPathnameRef.current = pathname
    resetAtRef.current = Date.now()
    setSecondsLeft(INACTIVITY_TIMEOUT_SEC)
    setShowWarning(false)
  }, [pathname, status])

  // Countdown for authenticated users
  useEffect(() => {
    if (status !== "authenticated") return

    const interval = setInterval(() => {
      if (callActiveRef.current) {
        setSecondsLeft(INACTIVITY_TIMEOUT_SEC)
        setShowWarning(false)
        return
      }

      const elapsed = Math.floor((Date.now() - resetAtRef.current) / 1000)
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_SEC - elapsed)
      setSecondsLeft(remaining)

      if (remaining <= INACTIVITY_WARNING_SEC && remaining > 0) {
        setShowWarning(true)
      } else if (remaining <= 0) {
        setShowWarning(false)
        void hardSignOut("/login?reason=timeout")
      }
    }, COUNTDOWN_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [status])

  const value: SessionActivityContextValue = {
    showWarning,
    secondsLeft,
    resetActivity,
    setCallActive,
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

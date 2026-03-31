"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { RefreshCw } from "lucide-react"

const PULL_THRESHOLD = 80
const RESISTANCE = 0.5

/** Pfade ohne Pull-to-Refresh (z.B. Checkout, Auth) */
const SKIP_PATHS = ["/pay", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

export function PullToRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const currentPullY = useRef(0)

  const shouldSkip = SKIP_PATHS.some((p) => pathname?.startsWith(p))
  const isNative = Capacitor.isNativePlatform()
  const isStandalone = typeof window !== "undefined" && (window.navigator as { standalone?: boolean }).standalone
  const isPWA = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches
  const isTouchMobile = typeof window !== "undefined" && "ontouchstart" in window
  const enabled = isNative || (isTouchMobile && (isStandalone || isPWA))

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 600)
  }, [router])

  useEffect(() => {
    currentPullY.current = pullY
  }, [pullY])

  useEffect(() => {
    if (shouldSkip || !enabled) return

    function onTouchStart(e: TouchEvent) {
      if (refreshing) return
      startY.current = e.touches[0].clientY
      currentPullY.current = 0
    }

    function onTouchMove(e: TouchEvent) {
      if (refreshing) return
      if (window.scrollY > 10) return

      const y = e.touches[0].clientY
      const dy = y - startY.current
      if (dy > 0) {
        e.preventDefault()
        const val = Math.min(dy * RESISTANCE, PULL_THRESHOLD * 1.2)
        currentPullY.current = val
        setPullY(val)
      }
    }

    function onTouchEnd() {
      if (refreshing) return
      const py = currentPullY.current
      setPullY(0)
      currentPullY.current = 0
      if (py >= PULL_THRESHOLD) {
        handleRefresh()
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
    }
  }, [shouldSkip, enabled, refreshing, handleRefresh])

  if (shouldSkip || !enabled) return null

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] flex justify-center transition-opacity duration-200"
      style={{
        height: Math.max(0, pullY),
        opacity: pullY > 10 ? 1 : 0,
      }}
    >
      <div
        className="flex flex-col items-center justify-end pb-2 pt-[env(safe-area-inset-top,0px)]"
        style={{ height: "100%" }}
      >
        <div
          className={`flex size-10 items-center justify-center rounded-full bg-[rgba(6,78,59,0.9)] text-primary-foreground shadow-lg ${
            refreshing ? "animate-spin" : ""
          }`}
          style={{
            transform: pullY > 0 && !refreshing ? `scale(${Math.min(1, pullY / PULL_THRESHOLD)})` : undefined,
          }}
        >
          <RefreshCw className="size-5" />
        </div>
        <span className="mt-1 text-xs font-medium text-muted-foreground">
          {pullY >= PULL_THRESHOLD ? "Loslassen zum Aktualisieren" : "Ziehen zum Aktualisieren"}
        </span>
      </div>
    </div>
  )
}

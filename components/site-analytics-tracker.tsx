"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  ANALYTICS_SESSION_STORAGE_KEY,
  ANALYTICS_VISITOR_STORAGE_KEY,
} from "@/lib/site-analytics"

function shouldTrackPath(pathname: string | null): pathname is string {
  if (!pathname) return false
  if (pathname.startsWith("/admin")) return false
  if (pathname.startsWith("/api")) return false
  return true
}

function ensureVisitorId(): string {
  try {
    const existing = localStorage.getItem(ANALYTICS_VISITOR_STORAGE_KEY)
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(ANALYTICS_VISITOR_STORAGE_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

async function postBeacon(body: Record<string, unknown>) {
  try {
    await fetch("/api/analytics/beacon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch {
    /* offline */
  }
}

/** Verhindert doppelte „init“-Sessions bei React Strict Mode (doppeltes Mount). */
let pendingInitSessionId: Promise<string | null> | null = null

/**
 * Erfasst anonyme Sitzungen, Seitenwechsel und aktive Verweildauer (sichtbarer Tab).
 * Wird im Root-Layout eingebunden; /admin wird nicht getrackt.
 */
export function SiteAnalyticsTracker() {
  const pathname = usePathname()
  const lastTrackedPath = useRef<string | null>(null)
  const pathEnteredAt = useRef<number>(Date.now())

  useEffect(() => {
    if (!shouldTrackPath(pathname)) return

    let cancelled = false

    void (async () => {
      let sid = sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY)

      if (!sid) {
        if (!pendingInitSessionId) {
          const visitorId = ensureVisitorId()
          const p = (async () => {
            const res = await fetch("/api/analytics/beacon", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "init",
                visitorId,
                path: pathname,
                referrer: typeof document !== "undefined" ? document.referrer : "",
              }),
            })
            const data = (await res.json().catch(() => ({}))) as { sessionId?: string }
            return data.sessionId ?? null
          })()
          pendingInitSessionId = p
          void p.finally(() => {
            if (pendingInitSessionId === p) pendingInitSessionId = null
          })
        }
        const newSid = await pendingInitSessionId
        if (cancelled) return
        if (newSid) {
          sid = newSid
          sessionStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, sid)
        }
        lastTrackedPath.current = pathname
        pathEnteredAt.current = Date.now()
        return
      }

      if (lastTrackedPath.current === null) {
        await postBeacon({ action: "page", sessionId: sid, path: pathname })
        if (cancelled) return
        lastTrackedPath.current = pathname
        pathEnteredAt.current = Date.now()
        return
      }

      if (lastTrackedPath.current === pathname) return

      const prev = lastTrackedPath.current
      const dur = Math.round((Date.now() - pathEnteredAt.current) / 1000)
      await postBeacon({
        action: "page",
        sessionId: sid,
        path: pathname,
        previousPath: prev,
        previousDurationSec: dur,
      })
      if (cancelled) return
      lastTrackedPath.current = pathname
      pathEnteredAt.current = Date.now()
    })()

    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    if (!shouldTrackPath(pathname)) return

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      const sid = sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY)
      if (!sid) return
      void postBeacon({ action: "pulse", sessionId: sid, seconds: 20 })
    }

    const id = window.setInterval(tick, 20_000)
    return () => window.clearInterval(id)
  }, [pathname])

  return null
}

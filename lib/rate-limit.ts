/**
 * In-memory sliding-window rate limiter.
 *
 * Pro Vercel-Instanz (Lambda) — Zähler werden bei Kaltstarts zurückgesetzt, aber bei wiederholten
 * Requests derselben Region oft wiederverwendet. Zusätzlich kostenlos: **Vercel Firewall / Bot
 * Protection** im Dashboard für globale Absicherung. Redis/Upstash nur nötig, wenn ihr
 * harte globale Limits ohne Plattform-Features braucht.
 *
 * Usage:
 *   const { success, retryAfterSec } = rateLimit(`login:${email}`, { limit: 5, windowSec: 900 })
 *   if (!success) return NextResponse.json({ error: "..." }, { status: 429 })
 */

interface Entry {
  count: number
  resetAt: number // unix ms
}

// Global singleton — persists across requests within one Lambda instance
const store = new Map<string, Entry>()

// Periodic cleanup to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, 5 * 60 * 1000) // every 5 min
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  retryAfterSec: number
}

export function rateLimit(
  identifier: string,
  { limit = 10, windowSec = 60 }: { limit?: number; windowSec?: number } = {}
): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSec * 1_000
  const entry = store.get(identifier)

  if (!entry || entry.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, retryAfterSec: 0 }
  }

  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1_000),
    }
  }

  entry.count++
  return { success: true, remaining: limit - entry.count, retryAfterSec: 0 }
}

/**
 * Mehrere Buckets nacheinander: alle müssen unter dem Limit bleiben.
 * Bei erstem Fehler: sofort abbrechen (vorherige Keys haben bereits +1 gezählt — bewusst).
 * Keys von restriktiv/specifisch → breit sortieren (z. B. userId vor IP).
 */
export function rateLimitAll(
  keys: string[],
  opts: { limit: number; windowSec: number }
): RateLimitResult {
  let last: RateLimitResult = { success: true, remaining: opts.limit, retryAfterSec: 0 }
  for (const key of keys) {
    last = rateLimit(key, opts)
    if (!last.success) return last
  }
  return last
}

/** Extract the best-effort client IP from a Next.js request */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const cf = req.headers.get("cf-connecting-ip")?.trim()
  if (cf) return cf
  return "unknown"
}

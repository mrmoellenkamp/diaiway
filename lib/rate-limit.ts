/**
 * In-memory sliding-window rate limiter.
 *
 * Works well on a single server / Vercel Lambda (instances are reused).
 * For multi-region production, swap the Map with Upstash Redis.
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

/** Extract the best-effort client IP from a Next.js request */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

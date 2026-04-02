/**
 * Globaler sliding-window Rate-Limiter.
 *
 * Strategie (Priorität):
 *  1. Upstash Redis (global, instanzübergreifend) – falls UPSTASH_REDIS_REST_URL +
 *     UPSTASH_REDIS_REST_TOKEN gesetzt sind.
 *  2. In-memory Fallback (pro Lambda-Instanz) – für lokale Entwicklung oder wenn
 *     kein Redis konfiguriert ist.
 *
 * Upstash einrichten: https://console.upstash.com → Redis DB anlegen → Env-Vars setzen:
 *   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=...
 *
 * Usage:
 *   const { success, retryAfterSec } = await rateLimit(`login:${email}`, { limit: 5, windowSec: 900 })
 *   if (!success) return NextResponse.json({ error: "..." }, { status: 429 })
 */

export interface RateLimitResult {
  success: boolean
  remaining: number
  retryAfterSec: number
}

// ─── In-Memory Fallback ───────────────────────────────────────────────────────

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, 5 * 60 * 1_000)
}

function rateLimitInMemory(
  identifier: string,
  limit: number,
  windowSec: number
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

// ─── Upstash Redis Backend ────────────────────────────────────────────────────

/**
 * Upstash REST-API INCR + EXPIRE:
 * - INCR zählt hoch und gibt den neuen Wert zurück.
 * - Beim ersten Zugriff (count === 1) wird EXPIRE gesetzt.
 * - Kein externes Package nötig – nur HTTP fetch.
 */
async function rateLimitRedis(
  identifier: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const key = `rl:${identifier}`

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  // Pipeline: INCR + TTL in einem Round-trip
  const pipelineRes = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify([["INCR", key], ["TTL", key]]),
  })

  if (!pipelineRes.ok) {
    // Redis nicht erreichbar → auf In-Memory-Fallback zurückfallen
    return rateLimitInMemory(identifier, limit, windowSec)
  }

  const pipeline = (await pipelineRes.json()) as [
    { result: number },
    { result: number },
  ]
  const count = pipeline[0].result
  const ttl = pipeline[1].result // -1 = kein TTL gesetzt

  // Beim ersten Zugriff TTL setzen
  if (count === 1 || ttl < 0) {
    await fetch(`${url}/expire/${key}/${windowSec}`, { method: "POST", headers })
  }

  const retryAfterSec = ttl > 0 ? ttl : windowSec

  if (count > limit) {
    return { success: false, remaining: 0, retryAfterSec }
  }

  return { success: true, remaining: Math.max(0, limit - count), retryAfterSec: 0 }
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

function hasRedis(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  )
}

export async function rateLimit(
  identifier: string,
  { limit = 10, windowSec = 60 }: { limit?: number; windowSec?: number } = {}
): Promise<RateLimitResult> {
  if (hasRedis()) {
    try {
      return await rateLimitRedis(identifier, limit, windowSec)
    } catch {
      // Netzwerkfehler → Fallback
      return rateLimitInMemory(identifier, limit, windowSec)
    }
  }
  return rateLimitInMemory(identifier, limit, windowSec)
}

/**
 * Mehrere Buckets nacheinander: alle müssen unter dem Limit bleiben.
 * Bei erstem Fehler sofort abbrechen.
 * Keys von restriktiv → breit sortieren (z. B. userId vor IP).
 */
export async function rateLimitAll(
  keys: string[],
  opts: { limit: number; windowSec: number }
): Promise<RateLimitResult> {
  let last: RateLimitResult = { success: true, remaining: opts.limit, retryAfterSec: 0 }
  for (const key of keys) {
    last = await rateLimit(key, opts)
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

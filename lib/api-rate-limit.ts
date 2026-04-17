/**
 * Zentrale Rate-Limit-Helper für API-Routen.
 *
 * Ziel: ein konsistenter Call in jeder mutierenden API-Route, der sowohl
 *  - einen userId-gebundenen Bucket (bei eingeloggten Nutzern), als auch
 *  - einen IP-gebundenen Bucket (für unauth oder als Zweitbremse)
 *
 * setzt — beide müssen unter dem Limit bleiben.  Bei Überschreitung wird eine
 * 429-Response mit Retry-After-Header zurückgegeben.
 *
 * Google Play / Apple Compliance: systemweites Rate-Limiting ist Teil der
 * "secure data handling"-Anforderungen (Play Security, App Store 5.1).
 */

import { NextResponse } from "next/server"
import { rateLimit, rateLimitAll, getClientIp, type RateLimitResult } from "@/lib/rate-limit"

export interface RateLimitOptions {
  /** eindeutiger Action-Bezeichner, z. B. "bookings:create" */
  bucket: string
  /** Anzahl erlaubter Requests in windowSec */
  limit: number
  /** Zeitfenster in Sekunden */
  windowSec: number
}

export interface AssertRateLimitContext {
  /** optional: eingeloggte userId (bindet Limit an Account) */
  userId?: string | null
  /** Request für IP-Extraktion */
  req: Request
}

/**
 * Liefert entweder `null` (alles ok, weitermachen) oder eine 429-Response.
 *
 * Strategie:
 *  - eingeloggt → Buckets [userId, ip], user zuerst (restriktiv)
 *  - anonym     → Bucket [ip]
 *
 * Die `limit`/`windowSec`-Werte werden auf **beide** Buckets gleich angewendet.
 * Wenn du pro Bucket unterschiedliche Schwellen brauchst, nutze direkt
 * `rateLimit()` aus `@/lib/rate-limit`.
 */
export async function assertRateLimit(
  ctx: AssertRateLimitContext,
  opts: RateLimitOptions
): Promise<NextResponse | null> {
  const ip = getClientIp(ctx.req)
  const keys: string[] = []
  if (ctx.userId) keys.push(`${opts.bucket}:u:${ctx.userId}`)
  keys.push(`${opts.bucket}:ip:${ip}`)

  const result: RateLimitResult = await rateLimitAll(keys, {
    limit: opts.limit,
    windowSec: opts.windowSec,
  })

  if (result.success) return null

  return NextResponse.json(
    {
      error: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
      code: "RATE_LIMITED",
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, result.retryAfterSec)),
      },
    }
  )
}

/** Convenience: rein IP-basiert. */
export async function assertIpRateLimit(
  req: Request,
  opts: RateLimitOptions
): Promise<NextResponse | null> {
  const ip = getClientIp(req)
  const result = await rateLimit(`${opts.bucket}:ip:${ip}`, {
    limit: opts.limit,
    windowSec: opts.windowSec,
  })
  if (result.success) return null
  return NextResponse.json(
    {
      error: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.",
      code: "RATE_LIMITED",
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, result.retryAfterSec)) },
    }
  )
}

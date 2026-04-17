/**
 * Kurzlebiger Speicher für sensible Guest-Checkout-Daten (Passwort für
 * Instant-Shugyo-Onboarding, Einwilligungen, InvoiceData).
 *
 * Hintergrund: Die Daten dürfen nicht dauerhaft in der DB landen (siehe Security
 * Audit — Passwort im Klartext in `booking.note`). Stattdessen speichern wir sie
 * in Upstash Redis mit TTL, bis der Stripe-Webhook sie einmalig abholt.
 *
 * Fallback: Wenn kein Upstash konfiguriert ist (lokale Entwicklung), greifen wir
 * auf eine In-Memory Map pro Lambda-Instanz zurück.  In Produktion MUSS Upstash
 * konfiguriert sein (beide Endpoints laufen typischerweise in unterschiedlichen
 * Lambda-Instanzen).
 *
 * Key-Schema:  guest-checkout:<bookingId>
 * Default-TTL: 30 Minuten (Checkout-Fenster reicht locker).
 */

import { logSecureWarn } from "@/lib/log-redact"

const KEY_PREFIX = "guest-checkout:"
const DEFAULT_TTL_SEC = 30 * 60

export interface GuestCheckoutPayload {
  guestPassword: string | null
  invoiceData: unknown
  consentWithdrawal: boolean
  consentSnapshot: boolean
  consentTimestamp: number
}

// ── In-Memory Fallback ─────────────────────────────────────────────────────

interface Entry {
  value: string
  expiresAt: number
}

const fallbackStore = new Map<string, Entry>()

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of fallbackStore) {
      if (entry.expiresAt <= now) fallbackStore.delete(key)
    }
  }, 60_000)
}

function hasRedis(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  )
}

// ── Upstash REST ───────────────────────────────────────────────────────────

async function redisSet(key: string, value: string, ttlSec: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  try {
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSec}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch (err) {
    logSecureWarn("guest-checkout-store.redisSet", err)
    return false
  }
}

async function redisGetDel(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  try {
    // GETDEL ist atomar: liest + löscht in einem Schritt
    const res = await fetch(`${url}/getdel/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result: string | null }
    return data?.result ?? null
  } catch (err) {
    logSecureWarn("guest-checkout-store.redisGetDel", err)
    return null
  }
}

async function redisGet(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result: string | null }
    return data?.result ?? null
  } catch {
    return null
  }
}

async function redisDel(key: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  try {
    await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* best-effort */
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Speichert Checkout-Daten für `bookingId`. Überschreibt vorhandene Einträge.
 * Default-TTL: 30 Minuten.
 */
export async function putGuestCheckoutData(
  bookingId: string,
  payload: GuestCheckoutPayload,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<void> {
  const key = `${KEY_PREFIX}${bookingId}`
  const serialized = JSON.stringify(payload)
  if (hasRedis()) {
    const ok = await redisSet(key, serialized, ttlSec)
    if (ok) return
    // falls Redis kurz ausgefallen ist, fallen wir NICHT auf In-Memory zurück,
    // weil der Webhook idR in einer anderen Instanz läuft. Stattdessen werfen.
    throw new Error("GUEST_CHECKOUT_STORE_UNAVAILABLE")
  }
  fallbackStore.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSec * 1_000,
  })
}

/**
 * Holt Daten atomar ab und löscht sie. Gibt null zurück, wenn nichts vorhanden.
 * Bei Nicht-Redis (lokal): nutzt In-Memory + Delete.
 */
export async function takeGuestCheckoutData(
  bookingId: string
): Promise<GuestCheckoutPayload | null> {
  const key = `${KEY_PREFIX}${bookingId}`
  let raw: string | null = null
  if (hasRedis()) {
    raw = await redisGetDel(key)
  } else {
    const entry = fallbackStore.get(key)
    if (entry && entry.expiresAt > Date.now()) {
      raw = entry.value
    }
    fallbackStore.delete(key)
  }
  if (!raw) return null
  try {
    return JSON.parse(raw) as GuestCheckoutPayload
  } catch {
    return null
  }
}

/**
 * Liest Daten ohne zu löschen (z.B. für Wiederholung eines Checkouts mit
 * derselben bookingId).
 */
export async function peekGuestCheckoutData(
  bookingId: string
): Promise<GuestCheckoutPayload | null> {
  const key = `${KEY_PREFIX}${bookingId}`
  let raw: string | null = null
  if (hasRedis()) {
    raw = await redisGet(key)
  } else {
    const entry = fallbackStore.get(key)
    if (entry && entry.expiresAt > Date.now()) {
      raw = entry.value
    }
  }
  if (!raw) return null
  try {
    return JSON.parse(raw) as GuestCheckoutPayload
  } catch {
    return null
  }
}

/** Explizit löschen, z.B. wenn Checkout storniert wird. */
export async function deleteGuestCheckoutData(bookingId: string): Promise<void> {
  const key = `${KEY_PREFIX}${bookingId}`
  if (hasRedis()) {
    await redisDel(key)
  } else {
    fallbackStore.delete(key)
  }
}

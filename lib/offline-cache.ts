"use client"

import { Capacitor } from "@capacitor/core"
import type { BookingRecord } from "./types"
import type { Takumi } from "./types"

const KEY_BOOKINGS = "diaiway-cache-bookings"
const KEY_TAKUMI_PREFIX = "diaiway-cache-takumi-"
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h

function isNative() {
  return Capacitor.isNativePlatform()
}

async function getPreference(key: string): Promise<string | null> {
  if (!isNative()) return null
  try {
    const { Preferences } = await import("@capacitor/preferences")
    const { value } = await Preferences.get({ key })
    return value
  } catch {
    return null
  }
}

async function setPreference(key: string, value: string): Promise<void> {
  if (!isNative()) return
  try {
    const { Preferences } = await import("@capacitor/preferences")
    await Preferences.set({ key, value })
  } catch {
    /* ignore */
  }
}

export interface CachedBookings {
  bookings: BookingRecord[]
  cachedAt: number
}

/** Gecachte Buchungen lesen (nur native). */
export async function getCachedBookings(): Promise<BookingRecord[] | null> {
  const raw = await getPreference(KEY_BOOKINGS)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as CachedBookings
    if (Date.now() - data.cachedAt > CACHE_MAX_AGE_MS) return null
    return data.bookings ?? null
  } catch {
    return null
  }
}

/** Buchungen im Cache speichern (nur native). */
export async function setCachedBookings(bookings: BookingRecord[]): Promise<void> {
  await setPreference(
    KEY_BOOKINGS,
    JSON.stringify({ bookings, cachedAt: Date.now() })
  )
}

/** Gecachtes Takumi-Profil lesen (nur native). */
export async function getCachedTakumi(id: string): Promise<Takumi | null> {
  const raw = await getPreference(KEY_TAKUMI_PREFIX + id)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as { takumi: Takumi; cachedAt: number }
    if (Date.now() - data.cachedAt > CACHE_MAX_AGE_MS) return null
    return data.takumi ?? null
  } catch {
    return null
  }
}

/** Takumi-Profil im Cache speichern (nur native). */
export async function setCachedTakumi(id: string, takumi: Takumi): Promise<void> {
  await setPreference(
    KEY_TAKUMI_PREFIX + id,
    JSON.stringify({ takumi, cachedAt: Date.now() })
  )
}

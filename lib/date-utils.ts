/**
 * Date utilities for Europe/Berlin timezone (CET/CEST).
 * Handles summer and winter time automatically.
 */

const BERLIN = "Europe/Berlin"

/** Kalendertag YYYY-MM-DD in einer Zeitzone (z. B. für Prisma-Feld `Booking.date`). */
export function formatYmdInTimeZone(d: Date, timeZone: string): string {
  return d.toLocaleDateString("sv-SE", { timeZone })
}

/** Gestern / heute / morgen in Europe/Berlin — Cron & Filter, wenn `date` in Berlin gespeichert ist. */
export function berlinDateStringsThreeDayWindow(now: Date = new Date()): string[] {
  const dayMs = 86400000
  return [
    ...new Set([
      formatYmdInTimeZone(new Date(now.getTime() - dayMs), BERLIN),
      formatYmdInTimeZone(now, BERLIN),
      formatYmdInTimeZone(new Date(now.getTime() + dayMs), BERLIN),
    ]),
  ]
}

/** Format options for Berlin timezone */
const berlinOptions: Intl.DateTimeFormatOptions = { timeZone: BERLIN }

/**
 * Format a date in Berlin time (date only, e.g. "09.03.2026").
 */
export function formatDateBerlin(date: Date, locale = "de-DE"): string {
  return date.toLocaleDateString(locale, { ...berlinOptions, day: "2-digit", month: "2-digit", year: "numeric" })
}

/**
 * Format a date in Berlin time (short: day + month, e.g. "09. März").
 */
export function formatDateBerlinShort(date: Date, locale = "de-DE"): string {
  return date.toLocaleDateString(locale, { ...berlinOptions, day: "2-digit", month: "short" })
}

/**
 * Format a time in Berlin time (e.g. "14:15").
 */
export function formatTimeBerlin(date: Date, locale = "de-DE"): string {
  return date.toLocaleTimeString(locale, { ...berlinOptions, hour: "2-digit", minute: "2-digit" })
}

/**
 * Format date and time in Berlin time.
 */
export function formatDateTimeBerlin(date: Date, locale = "de-DE"): string {
  return date.toLocaleString(locale, {
    ...berlinOptions,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Get the UTC offset string (e.g. "+01:00" or "+02:00") for Berlin on a given date.
 */
function getBerlinOffsetForDate(year: number, month: number, day: number): string {
  const noonUtc = new Date(Date.UTC(year, month, day, 12, 0, 0))
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: BERLIN,
    timeZoneName: "longOffset",
  }).formatToParts(noonUtc)
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "+01:00"
  const match = tz.match(/GMT([+-])(\d{1,2}):?(\d{2})?/)
  if (match) {
    const sign = match[1]
    const h = match[2].padStart(2, "0")
    const m = (match[3] ?? "00").padStart(2, "0")
    return `${sign}${h}:${m}`
  }
  return "+01:00"
}

/**
 * Parse a date string (YYYY-MM-DD) and time (HH:MM or HH:MM:SS) as Berlin local time.
 * Returns a Date (UTC internally) representing that moment in Berlin.
 */
export function parseBerlinDateTime(dateStr: string, timeStr: string): Date {
  const parts = timeStr.split(":").map(Number)
  const hour = parts[0] ?? 0
  const min = parts[1] ?? 0
  const sec = parts[2] ?? 0
  const [y, mo, d] = dateStr.split("-").map(Number)
  const year = y ?? 0
  const month = (mo ?? 1) - 1
  const day = d ?? 1
  const offset = getBerlinOffsetForDate(year, month, day)
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}${offset}`
  return new Date(iso)
}

/**
 * Get current date/time in Berlin. Use for comparisons when slots are stored as Berlin local.
 * Note: For server-side, set TZ=Europe/Berlin so new Date() matches Berlin.
 */
export function nowBerlin(): Date {
  return new Date()
}

/** 7-Tage-Regel: Buchungen dürfen max. 7 Tage in der Zukunft liegen */
const MAX_BOOKING_DAYS_AHEAD = 7

/**
 * Prüft, ob ein Termin (date + startTime) mehr als 7 Tage in der Zukunft liegt.
 * Liefert true, wenn die Buchung NICHT erlaubt ist (zu weit in der Zukunft).
 */
export function isBeyondMaxBookingDays(dateStr: string, startTime: string): boolean {
  const slotStart = parseBerlinDateTime(dateStr, startTime)
  const now = new Date()
  const maxDate = new Date(now)
  maxDate.setDate(maxDate.getDate() + MAX_BOOKING_DAYS_AHEAD)
  maxDate.setHours(23, 59, 59, 999)
  return slotStart > maxDate
}

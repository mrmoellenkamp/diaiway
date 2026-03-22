/**
 * Geplante Sessions: frühestens X Minuten vor Startzeit (Europe/Berlin) beitreten.
 * Muss mit Client und API identisch sein (siehe ARCHITECTURE.md).
 */
import { parseBerlinDateTime } from "@/lib/date-utils"

/** Frühester Beitritt = Terminbeginn minus dieses Fenster */
export const SCHEDULED_JOIN_LEAD_MS = 5 * 60 * 1000

export function getScheduledEarliestJoin(dateStr: string, startTimeStr: string): Date {
  const start = parseBerlinDateTime(dateStr, startTimeStr)
  return new Date(start.getTime() - SCHEDULED_JOIN_LEAD_MS)
}

/** true, wenn jetzt noch vor dem frühesten Beitritt (nur für geplante Slots relevant). */
export function isBeforeScheduledJoinWindow(now: Date, dateStr: string, startTimeStr: string): boolean {
  return now.getTime() < getScheduledEarliestJoin(dateStr, startTimeStr).getTime()
}

/** Für Fehlermeldungen: volle Minuten bis zum frühesten Beitritt (mind. 1 wenn noch in der Zukunft). */
export function minutesUntilScheduledJoinOpens(now: Date, dateStr: string, startTimeStr: string): number {
  const ms = getScheduledEarliestJoin(dateStr, startTimeStr).getTime() - now.getTime()
  if (ms <= 0) return 0
  return Math.ceil(ms / 60_000)
}

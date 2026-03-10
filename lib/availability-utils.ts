// Availability utility types and helper functions
// (Moved from lib/models/availability.ts — no longer tied to Mongoose)

export interface ITimeSlot {
  start: string // "08:00"
  end: string   // "18:00"
}

export type WeeklySlots = {
  0: ITimeSlot[]
  1: ITimeSlot[]
  2: ITimeSlot[]
  3: ITimeSlot[]
  4: ITimeSlot[]
  5: ITimeSlot[]
  6: ITimeSlot[]
}

export interface IWeeklyRule {
  name: string
  startWeek: number
  endWeek: number
  year?: number
  slots: WeeklySlots
}

export interface IDateException {
  date: string
  reason: string
  type: "unavailable" | "custom"
  slots?: ITimeSlot[]
}

export interface IAvailabilityData {
  slots: WeeklySlots
  yearlyRules: IWeeklyRule[]
  exceptions: IDateException[]
}

export const EMPTY_WEEKLY_SLOTS: WeeklySlots = {
  0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
}

/** Get ISO week number for a date */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** Resolve effective time slots for a specific date, applying rules and exceptions */
export function resolveSlots(
  avail: IAvailabilityData | null,
  dateStr: string // YYYY-MM-DD
): ITimeSlot[] {
  if (!avail) return []

  const date = new Date(dateStr + "T00:00:00")
  const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const week = getISOWeek(date)
  const year = date.getFullYear()

  // 1. Check for date-specific exception first
  const exception = avail.exceptions.find((e) => e.date === dateStr)
  if (exception) {
    if (exception.type === "unavailable") return []
    return exception.slots || []
  }

  // 2. Year-specific rule
  const yearSpecificRule = avail.yearlyRules.find(
    (r) => r.year === year && week >= r.startWeek && week <= r.endWeek
  )
  if (yearSpecificRule) return yearSpecificRule.slots[dayOfWeek] || []

  // 3. Generic yearly rule (no year specified)
  const genericRule = avail.yearlyRules.find(
    (r) => !r.year && week >= r.startWeek && week <= r.endWeek
  )
  if (genericRule) return genericRule.slots[dayOfWeek] || []

  // 4. Fall back to default weekly slots
  return avail.slots[dayOfWeek] || []
}

/**
 * Prüft ob die aktuelle Uhrzeit in einem der Instant-Slots für den Wochentag liegt.
 * Wenn instantSlots für den Tag leer ist → true (keine Einschränkung).
 */
export function isWithinInstantSlots(
  instantSlots: WeeklySlots | null | undefined,
  date: Date = new Date()
): boolean {
  if (!instantSlots) return true
  const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const slots = instantSlots[dayOfWeek]
  if (!slots || slots.length === 0) return true

  const nowMinutes = date.getHours() * 60 + date.getMinutes()

  for (const slot of slots) {
    const [sH, sM] = slot.start.split(":").map(Number)
    const [eH, eM] = slot.end.split(":").map(Number)
    const startMin = sH * 60 + sM
    const endMin = eH * 60 + eM
    if (nowMinutes >= startMin && nowMinutes < endMin) return true
  }
  return false
}

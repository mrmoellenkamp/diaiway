/**
 * Booking date validation for 7-day window rule.
 * Uses UTC for consistency across server/client timezones.
 */
import { parseBerlinDateTime } from "@/lib/date-utils"
import { addDays, isBefore, isAfter, startOfDay } from "date-fns"

const MAX_BOOKING_DAYS_AHEAD = 7

export type DateValidationResult =
  | { valid: true }
  | { valid: false; code: "DATE_PAST"; message: string }
  | { valid: false; code: "DATE_BEYOND_WINDOW"; message: string }

/**
 * Validates that selectedDate + startTime is within the 7-day booking window.
 * - Not in the past
 * - Not more than 7 days (168 hours) in the future
 *
 * @param dateStr - YYYY-MM-DD (Berlin local date)
 * @param startTimeStr - HH:mm or HH:mm:ss (Berlin local time)
 */
export function validateBookingDateWindow(
  dateStr: string,
  startTimeStr: string
): DateValidationResult {
  const now = new Date()
  const slotStart = parseBerlinDateTime(dateStr, startTimeStr)

  if (Number.isNaN(slotStart.getTime())) {
    return {
      valid: false,
      code: "DATE_PAST",
      message: "Ungültiges Datum oder Zeitformat.",
    }
  }

  if (isBefore(slotStart, now)) {
    return {
      valid: false,
      code: "DATE_PAST",
      message: "Buchungen in der Vergangenheit sind nicht möglich.",
    }
  }

  const maxAllowed = addDays(startOfDay(now), MAX_BOOKING_DAYS_AHEAD)
  maxAllowed.setHours(23, 59, 59, 999)

  if (isAfter(slotStart, maxAllowed)) {
    return {
      valid: false,
      code: "DATE_BEYOND_WINDOW",
      message: `Buchungen dürfen maximal ${MAX_BOOKING_DAYS_AHEAD} Tage im Voraus getätigt werden.`,
    }
  }

  return { valid: true }
}

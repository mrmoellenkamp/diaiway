import { parseBerlinDateTime } from "@/lib/date-utils"
import type { BookingRecord } from "@/lib/types"
import { isScheduledAwaitingStripeCompletion } from "@/lib/booking-display"

/** Minimale Buchungsdaten für Kalender-Freigabe und Client-URLs. */
export type BookingCalendarEligibilityFields = Pick<
  BookingRecord,
  "status" | "paymentStatus" | "date" | "startTime" | "endTime"
> & { bookingMode?: BookingRecord["bookingMode"] }

export function canOfferCalendarExport(booking: BookingCalendarEligibilityFields): boolean {
  const bookingMode = booking.bookingMode ?? "scheduled"
  if (
    isScheduledAwaitingStripeCompletion({
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      bookingMode,
    })
  ) {
    return false
  }
  if (
    booking.status === "cancelled" ||
    booking.status === "declined" ||
    booking.status === "cancelled_in_handshake" ||
    booking.status === "instant_expired"
  ) {
    return false
  }
  if (!booking.date?.trim() || !booking.startTime?.trim() || !booking.endTime?.trim()) return false
  return true
}

export function formatIcsUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const h = String(d.getUTCHours()).padStart(2, "0")
  const min = String(d.getUTCMinutes()).padStart(2, "0")
  const s = String(d.getUTCSeconds()).padStart(2, "0")
  return `${y}${m}${day}T${h}${min}${s}Z`
}

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
}

export function buildBookingIcs(opts: {
  bookingId: string
  date: string
  startTime: string
  endTime: string
  summary: string
  descriptionLines: string[]
  sessionUrl: string
}): string {
  const start = parseBerlinDateTime(opts.date, opts.startTime)
  const end = parseBerlinDateTime(opts.date, opts.endTime)
  const dtStamp = formatIcsUtc(new Date())
  const dtStart = formatIcsUtc(start)
  const dtEnd = formatIcsUtc(end)
  const uid = `${opts.bookingId}@diaiway.com`
  const desc = escapeIcsText(opts.descriptionLines.filter(Boolean).join("\n"))
  const summary = escapeIcsText(opts.summary)
  const location = escapeIcsText(opts.sessionUrl)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//diaiway//Booking//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.join("\r\n") + "\r\n"
}

/** Google Calendar „create event“ URL (UTC instants). */
export function buildGoogleCalendarEventUrl(opts: {
  date: string
  startTime: string
  endTime: string
  title: string
  details: string
  location: string
}): string {
  const start = parseBerlinDateTime(opts.date, opts.startTime)
  const end = parseBerlinDateTime(opts.date, opts.endTime)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  const dates = `${fmt(start)}/${fmt(end)}`
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates,
    details: opts.details,
  })
  if (opts.location) p.set("location", opts.location)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

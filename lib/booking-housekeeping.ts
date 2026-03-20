import { prisma } from "@/lib/db"
import { parseBerlinDateTime } from "@/lib/date-utils"

declare global {
  // eslint-disable-next-line no-var
  var __bookingHousekeepingLastRunAtMs: number | undefined
}

function berlinDateStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const y = parts.find((p) => p.type === "year")?.value ?? "1970"
  const m = parts.find((p) => p.type === "month")?.value ?? "01"
  const d = parts.find((p) => p.type === "day")?.value ?? "01"
  return `${y}-${m}-${d}`
}

/**
 * Auto-close stale scheduled bookings that were never executed.
 * Scope is intentionally conservative: only unpaid/failed scheduled bookings.
 */
export async function expireStaleScheduledBookings(now = new Date()): Promise<number> {
  // Rate limit per node process to avoid hammering DB on SWR/refresh traffic.
  const minIntervalMs = 60 * 60 * 1000 // 60 minutes
  const lastRunAt = globalThis.__bookingHousekeepingLastRunAtMs ?? 0
  if (Date.now() - lastRunAt < minIntervalMs) return 0
  globalThis.__bookingHousekeepingLastRunAtMs = Date.now()

  const todayBerlin = berlinDateStamp(now)
  const candidates = await prisma.booking.findMany({
    where: {
      bookingMode: "scheduled",
      status: { in: ["pending", "confirmed"] },
      paymentStatus: { in: ["unpaid", "failed"] },
      date: { lte: todayBerlin },
    },
    select: { id: true, date: true, startTime: true, endTime: true },
  })

  if (candidates.length === 0) return 0

  const staleIds = candidates
    .filter((b) => parseBerlinDateTime(b.date, b.endTime || b.startTime || "00:00") <= now)
    .map((b) => b.id)

  if (staleIds.length === 0) return 0

  const result = await prisma.booking.updateMany({
    where: { id: { in: staleIds }, status: { in: ["pending", "confirmed"] } },
    data: { status: "cancelled", cancelledAt: now },
  })

  return result.count
}

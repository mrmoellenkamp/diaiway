import type { BookingRecord } from "@/lib/types"

/**
 * Geplante Buchung direkt nach POST /api/bookings: Zahlung noch gar nicht gestartet (`unpaid`).
 * Für den Nutzer/Takumi keine „echte“ Anfrage — Takumi wird erst nach Zahlung benachrichtigt (`deferNotification`).
 * Diese Einträge nicht in „Geplant“ listen (vermeidet „Angefragt“ ohne abgeschlossene Buchung).
 */
export function isScheduledCheckoutShell(
  b: Pick<BookingRecord, "status" | "paymentStatus" | "bookingMode">
): boolean {
  if (b.bookingMode === "instant") return false
  return b.status === "pending" && b.paymentStatus === "unpaid"
}

/** Für Anzeige: Zahlung gestartet (Stripe-Session), aber noch nicht `paid` */
export function isScheduledAwaitingStripeCompletion(
  b: Pick<BookingRecord, "status" | "paymentStatus" | "bookingMode">
): boolean {
  if (b.bookingMode === "instant") return false
  return b.status === "pending" && b.paymentStatus === "pending"
}

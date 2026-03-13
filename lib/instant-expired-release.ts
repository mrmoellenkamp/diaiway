/**
 * Release payment for expired Instant Connect requests (Takumi didn't answer in 60s).
 * Same logic as Case A in session-terminate: cancel Stripe hold or release wallet.
 */
import { prisma } from "@/lib/db"
import { cancelOrRefundPaymentIntent } from "@/lib/stripe"
import { releaseReservation, refundTransactionForBooking } from "@/lib/wallet-service"

export type ReleaseResult = { ok: true } | { ok: false; error: string }

/**
 * Release payment hold for a single expired instant booking.
 * Idempotent: no-op if already released or unpaid.
 */
export async function releaseExpiredInstantPayment(
  bookingId: string
): Promise<ReleaseResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      stripePaymentIntentId: true,
      status: true,
    },
  })

  if (!booking) return { ok: false, error: "Booking not found" }
  if (booking.paymentStatus !== "paid") return { ok: true }
  if (!["pending", "instant_expired"].includes(booking.status)) return { ok: true }

  const piId = booking.stripePaymentIntentId
  const isWallet = piId === "wallet"

  if (isWallet) {
    const relResult = await releaseReservation(bookingId)
    if (!relResult.ok) {
      console.error("[instant-expired] releaseReservation failed:", relResult.error)
      return { ok: false, error: relResult.error ?? "Freigabe fehlgeschlagen." }
    }
  } else if (piId) {
    const cancelResult = await cancelOrRefundPaymentIntent(piId)
    if (!cancelResult.ok) {
      console.error("[instant-expired] Stripe cancel failed:", cancelResult.error)
      return { ok: false, error: cancelResult.error ?? "Stripe-Storno fehlgeschlagen." }
    }
    try {
      await refundTransactionForBooking(bookingId)
    } catch (walletErr) {
      console.error("[instant-expired] refundTransactionForBooking:", walletErr)
    }
  }

  return { ok: true }
}

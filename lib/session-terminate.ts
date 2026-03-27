/**
 * Shared session termination logic (Case A/B).
 * Used by: /api/sessions/[id]/terminate and ghost-session cron.
 *
 * Handshake-Grenzen:
 *   Instant Call:    60 Sek (Erst- und Folgekontakt)
 *   Guest Call:      60 Sek
 *   Geplanter Call:  300 Sek Erstkontakt, 30 Sek Folgekontakt
 */
import { prisma } from "@/lib/db"
import { cancelOrRefundPaymentIntent } from "@/lib/stripe"
import { releaseReservation, refundTransactionForBooking } from "@/lib/wallet-service"
import { processCompletion } from "@/app/actions/process-completion"

export type TerminateResult =
  | { ok: true; status: "cancelled_in_handshake" | "completed"; durationMs: number }
  | { ok: false; error: string }

export async function terminateSessionForBooking(bookingId: string): Promise<TerminateResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })

  if (!booking) {
    return { ok: false, error: "Buchung nicht gefunden." }
  }

  if (booking.status === "completed" || booking.status === "cancelled_in_handshake") {
    return {
      ok: true,
      status: booking.status,
      durationMs: 0,
    }
  }

  if (booking.status !== "active") {
    return {
      ok: false,
      error: `Terminierung nur aus Status "active" möglich (aktuell: ${booking.status}).`,
    }
  }

  const startedAt = booking.sessionStartedAt ?? booking.createdAt
  const durationInMs = Date.now() - new Date(startedAt).getTime()
  const durationSec = durationInMs / 1000

  const isInstant = booking.bookingMode === "instant"
  const isGuestCall = booking.isGuestCall ?? false

  // Handshake-Schwelle dynamisch bestimmen
  let handshakeSec: number
  if (isInstant || isGuestCall) {
    handshakeSec = 60
  } else {
    // Geplanter Call: hasPaidBefore aus DB prüfen
    const hasPaidBefore = !!(await prisma.booking.findFirst({
      where: {
        userId: booking.userId ?? undefined,
        expertId: booking.expertId,
        paymentStatus: "paid",
        id: { not: bookingId },
      },
      select: { id: true },
    }))
    handshakeSec = hasPaidBefore ? 30 : 300
  }

  const isHandshake = durationSec < handshakeSec

  if (isHandshake) {
    const piId = booking.stripePaymentIntentId
    const isWallet = piId === "wallet"
    const isPaid = booking.paymentStatus === "paid"

    if (isPaid) {
      if (isWallet) {
        const relResult = await releaseReservation(bookingId)
        if (!relResult.ok) {
          console.error("[terminate] Wallet releaseReservation failed:", relResult.error)
          return { ok: false, error: relResult.error ?? "Freigabe fehlgeschlagen." }
        }
      } else if (piId) {
        const cancelResult = await cancelOrRefundPaymentIntent(piId)
        if (!cancelResult.ok) {
          console.error("[terminate] Stripe cancel failed:", cancelResult.error)
          return { ok: false, error: cancelResult.error ?? "Stripe-Storno fehlgeschlagen." }
        }
        try {
          await refundTransactionForBooking(bookingId)
        } catch (walletErr) {
          console.error("[terminate] refundTransactionForBooking:", walletErr)
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "cancelled_in_handshake",
          sessionEndedAt: new Date(),
          sessionDuration: Math.round(durationInMs / 60_000),
          ...(isPaid && { paymentStatus: "refunded" as const }),
        },
      })
    })

    return {
      ok: true,
      status: "cancelled_in_handshake",
      durationMs: durationInMs,
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "completed",
        sessionEndedAt: new Date(),
        sessionDuration: Math.round(durationInMs / 60_000),
      },
    })
  })

  try {
    const result = await processCompletion(bookingId)
    if (!result.ok && !result.error?.includes("bereits verarbeitet")) {
      console.warn("[terminate] processCompletion:", result.error)
    }
  } catch (err) {
    console.error("[terminate] processCompletion error:", err)
  }

  return {
    ok: true,
    status: "completed",
    durationMs: durationInMs,
  }
}

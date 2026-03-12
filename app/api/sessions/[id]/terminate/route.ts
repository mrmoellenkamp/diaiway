import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cancelOrRefundPaymentIntent } from "@/lib/stripe"
import { releaseReservation, refundTransactionForBooking } from "@/lib/wallet-service"
import { processCompletion } from "@/app/actions/process-completion"

export const runtime = "nodejs"

const HANDSHAKE_LIMIT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * POST /api/sessions/[id]/terminate
 * Secure session termination and payment finalization.
 *
 * Business rules:
 * - Duration < 5 min (Handshake): Release payment hold (Stripe cancel / Wallet refund).
 * - Duration >= 5 min: Capture payment and complete session.
 *
 * Idempotent: Returns current status if already terminated.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id: bookingId } = await params

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })

  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }

  const uid = session.user.id
  const isShugyo = booking.userId === uid
  const isTakumi = booking.expert?.userId === uid
  if (!isShugyo && !isTakumi) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }

  // ── Idempotency: already terminated ─────────────────────────────────────
  if (booking.status === "completed" || booking.status === "cancelled_in_handshake") {
    return NextResponse.json({
      ok: true,
      status: booking.status,
      message: "Session bereits beendet.",
    })
  }

  if (booking.status !== "active") {
    return NextResponse.json(
      { error: `Terminierung nur aus Status "active" möglich (aktuell: ${booking.status}).` },
      { status: 409 }
    )
  }

  const startedAt = booking.sessionStartedAt ?? booking.createdAt
  const durationInMs = Date.now() - new Date(startedAt).getTime()
  const isHandshake = durationInMs < HANDSHAKE_LIMIT_MS

  if (isHandshake) {
    // ── Case A: Duration < 5 minutes — Release payment hold ────────────────
    const piId = booking.stripePaymentIntentId
    const isWallet = piId === "wallet"
    const isPaid = booking.paymentStatus === "paid"

    if (isPaid) {
      if (isWallet) {
        try {
          const relResult = await releaseReservation(bookingId)
          if (!relResult.ok) {
            console.error("[terminate] Wallet releaseReservation failed:", relResult.error)
            return NextResponse.json(
              { error: relResult.error ?? "Freigabe fehlgeschlagen." },
              { status: 500 }
            )
          }
        } catch (err) {
          console.error("[terminate] Wallet release error:", err)
          return NextResponse.json(
            { error: "Wallet-Freigabe fehlgeschlagen." },
            { status: 500 }
          )
        }
      } else if (piId) {
        try {
          const cancelResult = await cancelOrRefundPaymentIntent(piId)
          if (!cancelResult.ok) {
            console.error("[terminate] Stripe cancel failed:", cancelResult.error)
            return NextResponse.json(
              { error: cancelResult.error ?? "Stripe-Storno fehlgeschlagen." },
              { status: 502 }
            )
          }
          try {
            await refundTransactionForBooking(bookingId)
          } catch (walletErr) {
            console.error("[terminate] refundTransactionForBooking:", walletErr)
          }
        } catch (err) {
          console.error("[terminate] Stripe cancel error:", err)
          return NextResponse.json(
            { error: "Stripe-Storno fehlgeschlagen." },
            { status: 502 }
          )
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

    return NextResponse.json({
      ok: true,
      status: "cancelled_in_handshake",
      durationMs: durationInMs,
      message: "Handshake beendet. Zahlung wurde freigegeben.",
    })
  }

  // ── Case B: Duration >= 5 minutes — Complete and capture ─────────────────
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

  // processCompletion: generates invoices, moves wallet pendingBalance → balance for Takumi
  try {
    const result = await processCompletion(bookingId)
    if (!result.ok && !result.error?.includes("bereits verarbeitet")) {
      console.warn("[terminate] processCompletion:", result.error)
    }
  } catch (err) {
    console.error("[terminate] processCompletion error:", err)
    // Session is completed; completion (invoices etc.) may be retried by cron
  }

  return NextResponse.json({
    ok: true,
    status: "completed",
    durationMs: durationInMs,
    message: "Session abgeschlossen. Zahlung wurde eingezogen.",
  })
}

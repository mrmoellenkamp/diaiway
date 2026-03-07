import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { parseBerlinDateTime } from "@/lib/date-utils"

export const runtime = "nodejs"

/**
 * GET /api/bookings/[id]
 * Load a single booking enriched with expert data.
 * Only the booker (userId) or the expert owner may access it.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id } = await params

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { expert: true },
    })
    if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid

    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
    }

    // Compute cancel fee preview for current time
    const cancelPreview = computeCancelFee(booking, booking.expert)

    return NextResponse.json({
      booking: {
        id: booking.id,
        expertId: booking.expertId,
        expertName: booking.expertName,
        expertEmail: booking.expertEmail,
        takumiId: booking.expertId,
        takumiName: booking.expertName,
        takumiEmail: booking.expertEmail,
        takumiAvatar: booking.expert?.avatar || "",
        takumiSubcategory: booking.expert?.subcategory || "",
        takumiImageUrl: booking.expert?.imageUrl || "",
        userId: booking.userId,
        userName: booking.userName,
        userEmail: booking.userEmail,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        price: booking.price,
        note: booking.note,
        dailyRoomUrl: booking.dailyRoomUrl,
        sessionStartedAt: booking.sessionStartedAt,
        sessionEndedAt: booking.sessionEndedAt,
        sessionDuration: booking.sessionDuration,
        trialUsed: booking.trialUsed,
        paymentStatus: booking.paymentStatus,
        stripeSessionId: booking.stripeSessionId,
        stripePaymentIntentId: booking.stripePaymentIntentId,
        paidAt: booking.paidAt,
        paidAmount: booking.paidAmount,
        cancelledBy: booking.cancelledBy,
        cancelFeeAmount: booking.cancelFeeAmount,
        cancelledAt: booking.cancelledAt,
        cancelPreview,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface CancelPolicy {
  freeHours: number   // free cancellation window in hours before session
  feePercent: number  // % of booking fee retained after window (0–100)
}

interface CancelPreview {
  isFree: boolean
  hoursUntilSession: number
  freeHours: number
  feePercent: number
  feeAmount: number   // EUR cents to be retained
  refundAmount: number // EUR cents to be refunded
}

function parseCancelPolicy(raw: unknown): CancelPolicy {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const p = raw as Record<string, unknown>
    return {
      freeHours:  typeof p.freeHours === "number"  ? p.freeHours  : 24,
      feePercent: typeof p.feePercent === "number" ? p.feePercent : 0,
    }
  }
  return { freeHours: 24, feePercent: 0 }
}

function computeCancelFee(
  booking: { date: string; startTime: string; price: number; paymentStatus: string; paidAmount: number | null },
  expert: { cancelPolicy: unknown } | null
): CancelPreview {
  const policy = parseCancelPolicy(expert?.cancelPolicy)

  // Parse session datetime (Berlin time)
  const sessionDt = parseBerlinDateTime(booking.date, booking.startTime)
  const now = new Date()
  const hoursUntilSession = (sessionDt.getTime() - now.getTime()) / (1000 * 60 * 60)

  const isFree = hoursUntilSession >= policy.freeHours

  // Fee is based on paid amount (EUR cents) or price (EUR) if not yet paid
  const baseAmount = booking.paymentStatus === "paid" && booking.paidAmount
    ? booking.paidAmount           // EUR cents
    : booking.price * 100          // convert EUR → cents

  const feeAmount = isFree ? 0 : Math.round(baseAmount * policy.feePercent / 100)
  const refundAmount = baseAmount - feeAmount

  return {
    isFree,
    hoursUntilSession: Math.max(0, hoursUntilSession),
    freeHours: policy.freeHours,
    feePercent: policy.feePercent,
    feeAmount,
    refundAmount,
  }
}

// ─── PATCH ─────────────────────────────────────────────────────────────────

/**
 * PATCH /api/bookings/[id]
 * Session lifecycle: start-session | end-session | cancel
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id } = await params

  try {
    const { action } = await req.json()
    if (!action || !["start-session", "end-session", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "Ungueltige Aktion. Erlaubt: start-session, end-session, cancel." },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { expert: { select: { userId: true, cancelPolicy: true } } },
    })
    if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid
    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
    }

    // ── start-session ──────────────────────────────────────────────────────
    if (action === "start-session") {
      if (booking.status !== "confirmed") {
        return NextResponse.json(
          { error: `Session kann nur aus Status "confirmed" gestartet werden (aktuell: "${booking.status}").` },
          { status: 409 }
        )
      }

      // Allow joining max 5 minutes before the scheduled start time (Berlin time)
      const scheduledStart = parseBerlinDateTime(booking.date, booking.startTime)
      const earliestJoin   = new Date(scheduledStart.getTime() - 5 * 60 * 1000)
      if (new Date() < earliestJoin) {
        const minutesLeft = Math.ceil((earliestJoin.getTime() - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Der Raum öffnet 5 Minuten vor dem Termin. Noch ${minutesLeft} Minute(n).` },
          { status: 425 } // Too Early
        )
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { status: "active", sessionStartedAt: new Date() },
      })
      return NextResponse.json({ success: true, status: "active", sessionStartedAt: updated.sessionStartedAt })
    }

    // ── end-session ────────────────────────────────────────────────────────
    if (action === "end-session") {
      if (booking.status !== "active") {
        return NextResponse.json(
          { error: `Session kann nur aus Status "active" beendet werden (aktuell: "${booking.status}").` },
          { status: 409 }
        )
      }
      const now = new Date()
      const duration = booking.sessionStartedAt
        ? Math.round((now.getTime() - new Date(booking.sessionStartedAt).getTime()) / 60000)
        : 0

      const FREE_TRIAL_MINUTES = 5
      const isFreeSession = (duration ?? 0) < FREE_TRIAL_MINUTES

      // If session was under 5 minutes and was already paid → full automatic refund
      let autoRefunded = false
      if (isFreeSession && booking.paymentStatus === "paid" && booking.stripePaymentIntentId) {
        try {
          await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId })
          await prisma.booking.update({
            where: { id },
            data: { paymentStatus: "refunded" },
          })
          autoRefunded = true
        } catch (refundErr) {
          console.error("[end-session] Auto-refund für <5min Session fehlgeschlagen:", refundErr)
        }
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: "completed",
          sessionEndedAt: now,
          sessionDuration: duration,
          // Mark trial as used if session was free
          ...(isFreeSession ? { trialUsed: true } : {}),
        },
      })

      return NextResponse.json({
        success: true,
        status: "completed",
        sessionEndedAt: updated.sessionEndedAt,
        sessionDuration: updated.sessionDuration,
        autoRefunded,
        isFreeSession,
      })
    }

    // ── cancel ─────────────────────────────────────────────────────────────
    if (!["pending", "confirmed", "active"].includes(booking.status)) {
      return NextResponse.json(
        { error: `Nur "pending", "confirmed" oder "active" Buchungen koennen storniert werden (aktuell: "${booking.status}").` },
        { status: 409 }
      )
    }

    const cancelledBy = isExpert ? "expert" : "user"
    const now = new Date()

    // Compute cancellation fee
    // Experts who cancel always give a full refund (they bear the cost)
    const preview = computeCancelFee(booking, booking.expert)
    const feeApplies = !preview.isFree && cancelledBy === "user"
    const feeAmount    = feeApplies ? preview.feeAmount    : 0
    const refundAmount = feeApplies ? preview.refundAmount : (booking.paidAmount ?? booking.price * 100)

    let refundResult: {
      refunded: boolean
      refundId?: string
      partial?: boolean
      feeAmount?: number
      refundAmount?: number
      error?: string
    } = { refunded: false }

    if (booking.paymentStatus === "paid" && booking.stripePaymentIntentId) {
      try {
        const stripeRefundPayload: Parameters<typeof stripe.refunds.create>[0] = {
          payment_intent: booking.stripePaymentIntentId,
          reason: cancelledBy === "expert" ? "requested_by_customer" : "requested_by_customer",
        }
        // Partial refund if fee applies
        if (feeApplies && feeAmount > 0 && refundAmount > 0) {
          stripeRefundPayload.amount = refundAmount
        }

        const refund = await stripe.refunds.create(stripeRefundPayload)

        const newPaymentStatus = feeApplies && feeAmount > 0 ? "paid" : "refunded"
        await prisma.booking.update({
          where: { id },
          data: { paymentStatus: newPaymentStatus },
        })

        refundResult = {
          refunded: true,
          refundId: refund.id,
          partial: feeApplies && feeAmount > 0,
          feeAmount,
          refundAmount,
        }
      } catch (stripeErr) {
        console.error("[Stripe Refund] Failed:", stripeErr)
        refundResult = {
          refunded: false,
          error: stripeErr instanceof Error ? stripeErr.message : "Refund fehlgeschlagen",
        }
      }
    }

    const duration =
      booking.status === "active" && booking.sessionStartedAt
        ? Math.round((now.getTime() - new Date(booking.sessionStartedAt).getTime()) / 60000)
        : booking.sessionDuration

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledBy,
        cancelFeeAmount: feeApplies ? feeAmount : 0,
        cancelledAt: now,
        ...(booking.status === "active" ? { sessionEndedAt: now, sessionDuration: duration } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      status: "cancelled",
      cancelledBy,
      refund: refundResult,
      feeApplied: feeApplies,
      feeAmount,
      refundAmount,
      sessionDuration: updated.sessionDuration || 0,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * GET /api/bookings/[id]/cancel-preview
 * Returns the cancellation fee preview for a booking without actually cancelling.
 * Used by the UI to show the user what fee applies before confirming.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // We repurpose DELETE as a "preview" endpoint — returns fee info without modifying data
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const { id } = await params

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { expert: { select: { userId: true, cancelPolicy: true } } },
    })
    if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid
    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
    }

    const preview = computeCancelFee(booking, booking.expert)
    const isExpertCancelling = isExpert && !isBooker
    return NextResponse.json({ preview, isExpertCancelling })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

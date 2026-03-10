import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cancelOrRefundPaymentIntent } from "@/lib/stripe"
import { parseBerlinDateTime } from "@/lib/date-utils"
import { processCompletion } from "@/app/actions/process-completion"
import {
  creditRefundToShugyoWallet,
  refundTransactionForBooking,
  setTransactionOnHoldForBooking,
} from "@/lib/wallet-service"

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
      include: {
        expert: true,
        user: { select: { skillLevel: true, image: true } },
      },
    })
    if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid

    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: uid },
      select: { isBanned: true },
    })
    if (currentUser?.isBanned) {
      return NextResponse.json({ error: "Dein Zugang wurde gesperrt (diaiway Safety)." }, { status: 403 })
    }

    // Compute cancel fee preview for current time
    const cancelPreview = computeCancelFee(booking, booking.expert)

    // Für Takumi: Shugyo Kenntnisstufe + neueste Projektbilder laden
    let shugyoSkillLevel: string | null = null
    let shugyoProjects: { id: string; title: string; description: string; imageUrl: string }[] = []
    if (isExpert && booking.userId) {
      shugyoSkillLevel = booking.user?.skillLevel ?? null
      const projects = await prisma.shugyoProject.findMany({
        where: { userId: booking.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, description: true, imageUrl: true },
      })
      shugyoProjects = projects
    }

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
        userImageUrl: booking.user?.image || "",
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        bookingMode: booking.bookingMode,
        callType: booking.callType,
        totalPrice: booking.totalPrice != null ? Number(booking.totalPrice) : null,
        price: booking.price,
        note: booking.note,
        safetyAcceptedAt: booking.safetyAcceptedAt,
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
        isExpert, // true if current user is the Takumi (expert) for this booking
        shugyoSkillLevel,
        shugyoProjects,
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
  booking: { date: string; startTime: string; price?: number | null; totalPrice?: unknown; paymentStatus: string; paidAmount: number | null },
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
    : Math.round(Number(booking.totalPrice ?? booking.price ?? 0) * 100)  // EUR → cents

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
    const body = await req.json().catch(() => ({}))
    const { action, rating, reviewText } = body as {
      action?: string; rating?: number; reviewText?: string
    }
    if (!action || !["start-session", "end-session", "cancel", "submit-review", "submit-expert-rating", "report-and-leave", "release-payment", "report-problem", "accept-safety"].includes(action)) {
      return NextResponse.json(
        { error: "Ungueltige Aktion. Erlaubt: start-session, end-session, cancel, submit-review, submit-expert-rating, report-and-leave, release-payment, report-problem, accept-safety." },
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

    const currentUser = await prisma.user.findUnique({
      where: { id: uid },
      select: { isBanned: true },
    })
    if (currentUser?.isBanned) {
      return NextResponse.json({ error: "Dein Zugang wurde gesperrt (diaiway Safety)." }, { status: 403 })
    }

    // ── accept-safety (Pre-Call Safety-Gateway, nur Video) ──────────────────
    if (action === "accept-safety") {
      if (booking.status !== "pending" && booking.status !== "confirmed") {
        return NextResponse.json({ error: "Safety nur vor Session-Start." }, { status: 409 })
      }
      await prisma.booking.update({
        where: { id },
        data: { safetyAcceptedAt: new Date() },
      })
      return NextResponse.json({ success: true })
    }

    // ── report-and-leave ───────────────────────────────────────────────────
    if (action === "report-and-leave") {
      if (booking.status !== "active") {
        return NextResponse.json({ error: "Nur während eines aktiven Calls." }, { status: 409 })
      }
      const reportedId = isBooker ? booking.expert?.userId : booking.userId
      if (!reportedId) return NextResponse.json({ error: "Gegenpart nicht gefunden." }, { status: 400 })
      await prisma.safetyReport.create({
        data: {
          bookingId: id,
          reporterId: uid,
          reportedId,
          reporterRole: isBooker ? "shugyo" : "takumi",
          reason: "report_and_leave",
        },
      })
      await setTransactionOnHoldForBooking(id)
      const now = new Date()
      const duration = booking.sessionStartedAt
        ? Math.round((now.getTime() - new Date(booking.sessionStartedAt).getTime()) / 60000)
        : 0
      await prisma.booking.update({
        where: { id },
        data: { status: "completed", sessionEndedAt: now, sessionDuration: duration },
      })
      return NextResponse.json({ success: true, reportCreated: true })
    }

    // ── start-session ──────────────────────────────────────────────────────
    if (action === "start-session") {
      if (booking.status !== "confirmed" && booking.status !== "active") {
        return NextResponse.json(
          { error: `Session kann nur aus Status "confirmed" oder "active" gestartet werden (aktuell: "${booking.status}").` },
          { status: 409 }
        )
      }
      // Wenn bereits active (z.B. Partner hat gestartet), idempotent erfolgreich zurückgeben
      if (booking.status === "active") {
        return NextResponse.json({
          success: true,
          status: "active",
          sessionStartedAt: booking.sessionStartedAt,
        })
      }
      // Bei Instant: Zeitprüfung überspringen. Bei geplanten Terminen: max 5 Min vor Start
      if (booking.bookingMode !== "instant") {
        const scheduledStart = parseBerlinDateTime(booking.date, booking.startTime)
        const earliestJoin   = new Date(scheduledStart.getTime() - 5 * 60 * 1000)
        if (new Date() < earliestJoin) {
          const minutesLeft = Math.ceil((earliestJoin.getTime() - Date.now()) / 60000)
          return NextResponse.json(
            { error: `Der Raum öffnet 5 Minuten vor dem Termin. Noch ${minutesLeft} Minute(n).` },
            { status: 425 } // Too Early
          )
        }
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

      // If session was under 5 minutes and was already paid → full automatic refund (oder Cancel vor Capture)
      let autoRefunded = false
      if (isFreeSession && booking.paymentStatus === "paid" && booking.stripePaymentIntentId) {
        try {
          const res = await cancelOrRefundPaymentIntent(booking.stripePaymentIntentId)
          if (res.ok) {
            await prisma.booking.update({
              where: { id },
              data: { paymentStatus: "refunded" },
            })
            try {
              await refundTransactionForBooking(id)
            } catch (walletErr) {
              console.error("[end-session] refundTransactionForBooking:", walletErr)
            }
            autoRefunded = true
          }
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

      if (booking.bookingMode === "instant" && booking.expertId) {
        await prisma.expert.update({
          where: { id: booking.expertId },
          data: { liveStatus: "available" },
        })
      }

      return NextResponse.json({
        success: true,
        status: "completed",
        sessionEndedAt: updated.sessionEndedAt,
        sessionDuration: updated.sessionDuration,
        autoRefunded,
        isFreeSession,
      })
    }

    // ── release-payment (Shugyo gibt Zahlung sofort frei) ──────────────────
    if (action === "release-payment") {
      if (booking.status !== "completed") {
        return NextResponse.json(
          { error: "Freigabe nur nach abgeschlossener Session möglich." },
          { status: 409 }
        )
      }
      if (!isBooker) {
        return NextResponse.json(
          { error: "Nur der Shugyo kann die Zahlung freigeben." },
          { status: 403 }
        )
      }
      if (booking.paymentStatus !== "paid") {
        return NextResponse.json(
          { error: "Keine bezahlte Session zum Freigeben." },
          { status: 400 }
        )
      }
      const result = await processCompletion(id)
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Freigabe fehlgeschlagen." }, { status: 500 })
      }
      return NextResponse.json({ success: true, released: true })
    }

    // ── report-problem (Shugyo meldet Problem, Zahlung bleibt geprüft) ─────
    if (action === "report-problem") {
      if (booking.status !== "completed") {
        return NextResponse.json(
          { error: "Problem kann nur nach abgeschlossener Session gemeldet werden." },
          { status: 409 }
        )
      }
      if (!isBooker) {
        return NextResponse.json(
          { error: "Nur der Shugyo kann ein Problem melden." },
          { status: 403 }
        )
      }
      const reportedId = booking.expert?.userId
      if (!reportedId) return NextResponse.json({ error: "Experte nicht gefunden." }, { status: 400 })
      await prisma.safetyReport.create({
        data: {
          bookingId: id,
          reporterId: uid,
          reportedId,
          reporterRole: "shugyo",
          reason: "session_problem",
          details: "Shugyo hat nach der Session ein Problem gemeldet. Betrag wird geprüft.",
        },
      })
      await setTransactionOnHoldForBooking(id)
      return NextResponse.json({ success: true, reportCreated: true })
    }

    // ── submit-review (Shugyo bewertet Takumi) ─────────────────────────────
    if (action === "submit-review") {
      if (booking.status !== "completed") {
        return NextResponse.json(
          { error: "Bewertung nur nach abgeschlossener Session möglich." },
          { status: 409 }
        )
      }
      if (!isBooker) {
        return NextResponse.json({ error: "Nur der Buchungsersteller kann den Experten bewerten." }, { status: 403 })
      }
      const r = Math.min(5, Math.max(1, Number(rating) || 0))
      if (r < 1) {
        return NextResponse.json({ error: "Bitte wähle 1–5 Sterne." }, { status: 400 })
      }
      await prisma.review.create({
        data: {
          expertId: booking.expertId,
          userId: booking.userId,
          rating: r,
          text: (reviewText || "").trim().slice(0, 2000),
        },
      })
      // Update expert's aggregate rating
      const reviews = await prisma.review.findMany({ where: { expertId: booking.expertId }, select: { rating: true } })
      const avg = reviews.reduce((s, x) => s + x.rating, 0) / reviews.length
      await prisma.expert.update({
        where: { id: booking.expertId },
        data: { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length },
      })
      return NextResponse.json({ success: true })
    }

    // ── submit-expert-rating (Takumi bewertet Shugyo) ───────────────────────
    if (action === "submit-expert-rating") {
      if (booking.status !== "completed") {
        return NextResponse.json(
          { error: "Bewertung nur nach abgeschlossener Session möglich." },
          { status: 409 }
        )
      }
      if (!isExpert) {
        return NextResponse.json({ error: "Nur der Experte kann den Nutzer bewerten." }, { status: 403 })
      }
      const r = Math.min(5, Math.max(1, Number(rating) || 0))
      if (r < 1) {
        return NextResponse.json({ error: "Bitte wähle 1–5 Sterne." }, { status: 400 })
      }
      await prisma.booking.update({
        where: { id },
        data: {
          expertRating: r,
          expertReviewText: (reviewText || "").trim().slice(0, 2000),
        },
      })
      return NextResponse.json({ success: true })
    }

    // ── cancel ─────────────────────────────────────────────────────────────
    if (action !== "cancel") {
      return NextResponse.json({ error: "Ungueltige Aktion." }, { status: 400 })
    }
    if (!["pending", "confirmed", "active"].includes(booking.status)) {
      return NextResponse.json(
        { error: `Nur "pending", "confirmed" oder "active" Buchungen koennen storniert werden (aktuell: "${booking.status}").` },
        { status: 409 }
      )
    }

    const cancelledBy = isExpert ? "expert" : "user"
    const now = new Date()

    // booking_request Benachrichtigungen für Takumi entfernen (Anfrage erledigt durch Stornierung)
    if (booking.expert?.userId) {
      await prisma.notification.deleteMany({
        where: { bookingId: id, type: "booking_request", userId: booking.expert.userId },
      })
    }

    // Compute cancellation fee
    // Experts who cancel always give a full refund (they bear the cost)
    const preview = computeCancelFee(booking, booking.expert)
    const feeApplies = !preview.isFree && cancelledBy === "user"
    const feeAmount    = feeApplies ? preview.feeAmount    : 0
    const refundAmount = feeApplies ? preview.refundAmount : (booking.paidAmount ?? (booking.price ?? 0) * 100)

    let refundResult: {
      refunded: boolean
      refundId?: string
      partial?: boolean
      feeAmount?: number
      refundAmount?: number
      error?: string
    } = { refunded: false }

    if (booking.paymentStatus === "paid" && booking.stripePaymentIntentId) {
      const isWallet = booking.stripePaymentIntentId === "wallet"
      try {
        if (isWallet) {
          await creditRefundToShugyoWallet(id)
          refundResult = { refunded: true, refundAmount, partial: feeApplies && feeAmount > 0, feeAmount }
        } else {
          const res = await cancelOrRefundPaymentIntent(booking.stripePaymentIntentId, {
            amount: feeApplies && refundAmount > 0 ? refundAmount : undefined,
            reason: "requested_by_customer",
          })
          if (!res.ok) throw new Error(res.error)
          refundResult = { refunded: true, refundAmount, partial: feeApplies && feeAmount > 0, feeAmount }
        }
        const newPaymentStatus = feeApplies && feeAmount > 0 ? "paid" : "refunded"
        await prisma.booking.update({
          where: { id },
          data: { paymentStatus: newPaymentStatus },
        })
        try {
          await refundTransactionForBooking(id)
        } catch (walletErr) {
          console.error("[Booking Cancel] refundTransactionForBooking:", walletErr)
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

    const cancelResponse = NextResponse.json({
      success: true,
      status: "cancelled",
      cancelledBy,
      refund: refundResult,
      feeApplied: feeApplies,
      feeAmount,
      refundAmount,
      sessionDuration: updated.sessionDuration || 0,
    })
    return cancelResponse
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

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { stripe } from "@/lib/stripe"

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
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

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
      include: { expert: { select: { userId: true } } },
    })
    if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

    const uid = session.user.id
    const isBooker = booking.userId === uid
    const isExpert = booking.expert?.userId === uid
    if (!isBooker && !isExpert) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
    }

    if (action === "start-session") {
      if (booking.status !== "confirmed") {
        return NextResponse.json(
          { error: `Session kann nur aus Status "confirmed" gestartet werden (aktuell: "${booking.status}").` },
          { status: 409 }
        )
      }
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: "active", sessionStartedAt: new Date() },
      })
      return NextResponse.json({ success: true, status: "active", sessionStartedAt: updated.sessionStartedAt })
    }

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
        : null
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: "completed", sessionEndedAt: now, sessionDuration: duration },
      })
      return NextResponse.json({
        success: true,
        status: "completed",
        sessionEndedAt: updated.sessionEndedAt,
        sessionDuration: updated.sessionDuration,
      })
    }

    // action === "cancel"
    if (!["pending", "confirmed", "active"].includes(booking.status)) {
      return NextResponse.json(
        { error: `Nur "pending", "confirmed" oder "active" Buchungen koennen storniert werden (aktuell: "${booking.status}").` },
        { status: 409 }
      )
    }

    let refundResult: { refunded: boolean; refundId?: string; error?: string } = { refunded: false }

    if (booking.paymentStatus === "paid" && booking.stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          reason: "requested_by_customer",
        })
        refundResult = { refunded: true, refundId: refund.id }
        await prisma.booking.update({ where: { id }, data: { paymentStatus: "refunded" } })
      } catch (stripeErr) {
        console.error("[Stripe Refund] Failed:", stripeErr)
        refundResult = {
          refunded: false,
          error: stripeErr instanceof Error ? stripeErr.message : "Refund fehlgeschlagen",
        }
      }
    }

    const now = new Date()
    const duration =
      booking.status === "active" && booking.sessionStartedAt
        ? Math.round((now.getTime() - new Date(booking.sessionStartedAt).getTime()) / 60000)
        : booking.sessionDuration

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        ...(booking.status === "active" ? { sessionEndedAt: now, sessionDuration: duration } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      status: "cancelled",
      refund: refundResult,
      sessionDuration: updated.sessionDuration || 0,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

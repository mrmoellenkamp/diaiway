import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cancelOrRefundPaymentIntent } from "@/lib/stripe"
import { refundTransactionForBooking, creditRefundToShugyoWallet } from "@/lib/wallet-service"
import { sendBookingStatusEmail, transporter, smtpFrom } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"
import type { BookingStatus } from "@prisma/client"

export const runtime = "nodejs"

/** Resolve auth: token (email link) or session (logged-in expert) */
async function resolveBookingAuth(id: string, token: string | null) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { expert: true },
  })
  if (!booking) return { error: "Buchung nicht gefunden." as const, booking: null }
  if (token?.trim()) {
    if (booking.statusToken !== token) return { error: "Ungültiger Token." as const, booking: null }
    return { error: null, booking }
  }
  const session = await auth()
  if (!session?.user?.id) return { error: "Token fehlt oder nicht eingeloggt." as const, booking: null }
  if (!booking.expert?.userId || booking.expert.userId !== session.user.id) return { error: "Keine Berechtigung." as const, booking: null }
  return { error: null, booking }
}

/** GET — load booking info (token from email link, or session for logged-in expert) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = req.nextUrl.searchParams.get("token")

  const { error, booking } = await resolveBookingAuth(id, token)
  if (error) return NextResponse.json({ error }, { status: token ? 403 : 401 })
  if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

  return NextResponse.json({
    id: booking.id,
    userId: booking.userId,
    expertId: booking.expertId,
    userName: booking.userName,
    userEmail: booking.userEmail,
    expertName: booking.expertName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    price: booking.price,
    note: booking.note,
    status: booking.status,
  })
}

/** POST — confirm, decline, or send a question (token from email, or session for logged-in expert) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { token, action, message } = body as { token?: string; action?: string; message?: string }

  const { error, booking } = await resolveBookingAuth(id, token ?? null)
  if (error) return NextResponse.json({ error }, { status: 400 })
  if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

  const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"
  const effectiveToken = token || booking.statusToken

  // ── Confirm or Decline ───────────────────────────────────────────────────
  if (action === "confirmed" || action === "declined") {
    if (booking.status !== "pending") {
      return NextResponse.json({ error: `Bereits als „${booking.status}" markiert.` }, { status: 409 })
    }

    await prisma.booking.update({
      where: { id },
      data: { status: action as BookingStatus },
    })

    // Bei Ablehnung + bereits bezahlt: Refund an Shugyo (Auszahlung oder Wallet-Gutschrift)
    if (action === "declined" && booking.paymentStatus === "paid") {
      try {
        const shugyo = await prisma.user.findUnique({
          where: { id: booking.userId },
          select: { refundPreference: true },
        })
        const pref = (shugyo?.refundPreference as "payout" | "wallet") || "payout"

        const paidViaWallet = !booking.stripePaymentIntentId || booking.stripePaymentIntentId === "wallet"
        if (paidViaWallet || pref === "wallet") {
          // Guthaben ins Wallet gutschreiben (kein Stripe-Refund)
          const res = await creditRefundToShugyoWallet(id)
          if (!res.ok) console.error("[booking-respond] Wallet-Gutschrift fehlgeschlagen:", res.error)
        } else {
          // Auszahlung auf Karte (Stripe Cancel/Refund) — Hold & Capture: vor Capture cancel, nach Capture refund
          const pi = booking.stripePaymentIntentId
          if (pi && pi !== "wallet" && pi.startsWith("pi_")) {
            const res = await cancelOrRefundPaymentIntent(pi)
            if (res.ok) await refundTransactionForBooking(id)
          } else if (pi === "wallet") {
            // Ursprünglich mit Wallet bezahlt → Gutschrift zurück
            await creditRefundToShugyoWallet(id)
          }
        }
        await prisma.booking.update({
          where: { id },
          data: { paymentStatus: "refunded" },
        })
      } catch (refundErr) {
        console.error("[booking-respond] Refund bei Ablehnung fehlgeschlagen:", refundErr)
      }
    }

    try {
      await sendBookingStatusEmail({
        to: booking.userEmail,
        userName: booking.userName,
        takumiName: booking.expertName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: action,
      })
    } catch { /* email errors must not block the response */ }

    // Notification für Shugyo (zeitgleich mit E-Mail)
    try {
      const title = action === "confirmed" ? "Buchung bestätigt" : "Buchung abgelehnt"
      const body =
        action === "confirmed"
          ? `${booking.expertName} hat deine Buchung am ${booking.date} (${booking.startTime}–${booking.endTime}) bestätigt.`
          : `${booking.expertName} hat deine Buchungsanfrage am ${booking.date} leider abgelehnt.`
      await prisma.notification.create({
        data: {
          userId: booking.userId,
          type: action === "confirmed" ? "booking_confirmed" : "booking_declined",
          bookingId: booking.id,
          title,
          body,
        },
      })
      sendPushToUser(booking.userId, { title, body, url: "/messages" }).catch(() => {})
    } catch { /* notification errors must not block */ }

    return NextResponse.json({ ok: true, status: action })
  }

  // ── Rückfrage ────────────────────────────────────────────────────────────
  if (action === "ask") {
    if (!message?.trim()) {
      return NextResponse.json({ error: "Nachricht darf nicht leer sein." }, { status: 400 })
    }

    const respondUrl = `${baseUrl}/booking/respond/${id}?token=${effectiveToken}&action=confirmed`

    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: booking.userEmail,
        replyTo: booking.expertEmail,
        subject: `diAiway – Rückfrage von ${booking.expertName} zu deiner Buchung`,
        html: `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#fafaf9;"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
<tr><td style="background:linear-gradient(135deg,#1c1917,#292524);padding:24px 40px;text-align:center;">
  <span style="font-size:20px;font-weight:700;color:#f0fdf4;">di<span style="color:#f59e0b;">Ai</span>way</span>
</td></tr>
<tr><td style="padding:32px 40px;">
  <h1 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1c1917;">Rückfrage zu deiner Buchungsanfrage</h1>
  <p style="margin:0 0 8px;font-size:14px;color:#78716c;">Hallo <strong style="color:#1c1917;">${booking.userName}</strong>,</p>
  <p style="margin:0 0 20px;font-size:14px;color:#78716c;">
    <strong style="color:#1c1917;">${booking.expertName}</strong> hat eine Rückfrage zu deiner Buchung am
    <strong style="color:#1c1917;">${booking.date}</strong> (${booking.startTime}–${booking.endTime} Uhr):
  </p>
  <table width="100%" style="background:#f5f5f4;border-radius:12px;margin-bottom:24px;"><tr><td style="padding:16px 20px;">
    <p style="margin:0;font-size:14px;line-height:1.6;color:#1c1917;">${message.replace(/\n/g, "<br/>")}</p>
  </td></tr></table>
  <p style="margin:0 0 16px;font-size:13px;color:#78716c;">
    Du kannst direkt auf diese E-Mail antworten oder die Buchung über den folgenden Link bestätigen:
  </p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <a href="${respondUrl}" style="display:inline-block;padding:12px 28px;background:#064e3b;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
      Buchungsanfrage ansehen
    </a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:16px 40px 20px;border-top:1px solid #e7e5e3;text-align:center;">
  <p style="margin:0;font-size:11px;color:#a8a29e;">&copy; ${new Date().getFullYear()} diAiway</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
      })
    } catch (err) {
      console.error("[email] Rückfrage senden fehlgeschlagen:", err)
      return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden." }, { status: 500 })
    }

    // Notification für Shugyo (zeitgleich mit E-Mail)
    try {
      const notifBody = `${booking.expertName} hat eine Rückfrage gestellt: ${message.trim().slice(0, 120)}${message.length > 120 ? "…" : ""}`
      await prisma.notification.create({
        data: {
          userId: booking.userId,
          type: "booking_question",
          bookingId: booking.id,
          title: "Rückfrage zu deiner Buchung",
          body: notifBody,
        },
      })
      sendPushToUser(booking.userId, {
        title: "Rückfrage zu deiner Buchung",
        body: notifBody,
        url: "/messages",
      }).catch(() => {})
    } catch { /* notification errors must not block */ }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 })
}

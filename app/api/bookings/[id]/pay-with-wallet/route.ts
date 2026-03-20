import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { payBookingWithWallet } from "@/lib/wallet-service"
import { notifyTakumiAfterPayment } from "@/lib/notification-service"
import { markVerified } from "@/lib/verification-service"
import { getInvoiceGateResult } from "@/lib/payment-invoice-guard"
import { getRequestLocale } from "@/lib/server-locale"
import { rateLimitAll, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

/**
 * POST /api/bookings/[id]/pay-with-wallet
 * Shugyo bezahlt eine Buchung mit Wallet-Guthaben.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const ip = getClientIp(req)
  const rl = rateLimitAll(
    [`wallet-pay:user:${session.user.id}`, `wallet-pay:ip:${ip}`],
    { limit: 25, windowSec: 3600 }
  )
  if (!rl.success) {
    return NextResponse.json(
      { error: "Zu viele Zahlungsversuche. Bitte später erneut versuchen.", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    )
  }

  const locale = await getRequestLocale()

  const { id: bookingId } = await params

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }
  if (booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }
  if (booking.paymentStatus === "paid") {
    return NextResponse.json({ ok: true, message: "Bereits bezahlt." })
  }

  const invoiceGate = await getInvoiceGateResult(session.user.id, locale)
  if (!invoiceGate.ok) {
    return NextResponse.json(
      {
        error: invoiceGate.message,
        code: "INVOICE_INCOMPLETE",
        missingFieldKeys: invoiceGate.missingFieldKeys,
      },
      { status: 400 }
    )
  }

  const result = await payBookingWithWallet(bookingId)
  if (!result.ok) {
    if (result.error === "INSUFFICIENT_FUNDS") {
      return NextResponse.json(
        { error: "Nicht genügend Guthaben im Wallet.", code: "INSUFFICIENT_FUNDS" },
        { status: 402 }
      )
    }
    if (result.error === "INVOICE_INCOMPLETE") {
      const g = await getInvoiceGateResult(session.user.id, locale)
      return NextResponse.json(
        {
          error: g.ok ? "Rechnungsdaten unvollständig." : g.message,
          code: "INVOICE_INCOMPLETE",
          missingFieldKeys: g.ok ? [] : g.missingFieldKeys,
        },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: result.error || "Zahlung fehlgeschlagen." },
      { status: 400 }
    )
  }

  await markVerified(session.user.id, "STRIPE_PAYMENT").catch(() => {})

  try {
    await notifyTakumiAfterPayment(bookingId)
  } catch (notifyErr) {
    console.error("[pay-with-wallet] Notification failed:", notifyErr)
  }

  return NextResponse.json({ ok: true, message: "Bezahlung erfolgreich." })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cancelOrRefundPaymentIntent } from "@/lib/stripe"
import { creditRefundToShugyoWallet, refundTransactionForBooking } from "@/lib/wallet-service"

/**
 * POST /api/admin/finance/refund
 * Admin: Stornierung einer CAPTURED-Transaktion einleiten.
 * Body: { transactionId: string }
 * - Wallet: creditRefundToShugyoWallet
 * - Stripe: cancelOrRefundPaymentIntent + refundTransactionForBooking
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  let body: { transactionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 })
  }
  const { transactionId } = body
  if (!transactionId) {
    return NextResponse.json({ error: "transactionId erforderlich." }, { status: 400 })
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { booking: { include: { expert: true } } },
  })
  if (!tx) return NextResponse.json({ error: "Transaktion nicht gefunden." }, { status: 404 })
  if (tx.status !== "CAPTURED" && tx.status !== "COMPLETED") {
    return NextResponse.json({ error: "Nur CAPTURED-Transaktionen können storniert werden." }, { status: 409 })
  }

  const refDate = tx.completedAt ?? tx.createdAt
  const ageDays = refDate ? (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24) : 0
  if (ageDays > 180) {
    return NextResponse.json(
      { error: "Stornierung nur innerhalb von 180 Tagen möglich (Stripe-Limit)." },
      { status: 409 }
    )
  }

  const booking = tx.booking
  if (!booking) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })

  const isWallet = booking.stripePaymentIntentId === "wallet"

  try {
    if (isWallet) {
      const res = await creditRefundToShugyoWallet(booking.id)
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
    } else {
      const refundRes = await cancelOrRefundPaymentIntent(booking.stripePaymentIntentId!)
      if (!refundRes.ok) {
        return NextResponse.json(
          { error: `Stripe-Refund fehlgeschlagen: ${refundRes.error}` },
          { status: 502 }
        )
      }
      const walletRes = await refundTransactionForBooking(booking.id)
      if (!walletRes.ok) {
        return NextResponse.json({ error: walletRes.error }, { status: 500 })
      }
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "cancelled",
        cancelledBy: "admin",
        cancelledAt: new Date(),
        paymentStatus: "refunded",
      },
    })

    return NextResponse.json({ success: true, message: "Stornierung durchgeführt." })
  } catch (err) {
    console.error("[admin/finance/refund] Error:", err)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json(
      { error: sanitizeErrorForClient(err) },
      { status: 500 }
    )
  }
}

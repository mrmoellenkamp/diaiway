import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cancelOrRefundPaymentIntent } from "@/lib/stripe"
import { releaseReservation, refundTransactionForBooking } from "@/lib/wallet-service"

/**
 * POST /api/admin/finance/manual-release
 * Admin: Manual release of a hold (free Shugyo credit limit).
 * Stripe: cancel PI. Wallet: release reservation.
 * Logs to AdminActionLog.
 */
export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  let body: { bookingId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const bookingId = body.bookingId?.trim()
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId fehlt." }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { stripePaymentIntentId: true, paymentStatus: true },
  })
  if (!booking) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }

  const isWallet = booking.stripePaymentIntentId === "wallet"

  try {
    if (isWallet) {
      const res = await releaseReservation(bookingId)
      if (!res.ok) {
        return NextResponse.json({ error: res.error ?? "Freigabe fehlgeschlagen." }, { status: 400 })
      }
    } else if (booking.stripePaymentIntentId) {
      const cancelResult = await cancelOrRefundPaymentIntent(booking.stripePaymentIntentId)
      if (!cancelResult.ok) {
        return NextResponse.json({ error: cancelResult.error ?? "Stripe-Storno fehlgeschlagen." }, { status: 400 })
      }
      await refundTransactionForBooking(bookingId)
    } else {
      return NextResponse.json({ error: "Keine Zahlung zum Freigeben." }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: "refunded" },
      })
      await tx.adminActionLog.create({
        data: {
          adminId: session.user.id,
          action: "manual_release",
          targetType: "booking",
          targetId: bookingId,
          details: { paymentType: isWallet ? "wallet" : "stripe" },
        },
      })
    })

    return NextResponse.json({ success: true, message: "Hold freigegeben." })
  } catch (err) {
    console.error("[admin/finance/manual-release] Error:", err)
    return NextResponse.json({ error: "Freigabe fehlgeschlagen." }, { status: 500 })
  }
}

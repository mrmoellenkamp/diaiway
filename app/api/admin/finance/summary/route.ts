import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const STRIPE_HOLD_DAYS = 7

/**
 * GET /api/admin/finance/summary
 * Escrow/Finance monitoring: Stripe holds, days until expiry, Shugyo wallet liability.
 * Admin only.
 */
export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  try {
    // Transactions with AUTHORIZED (hold) + paid booking
    const authorizedTxs = await prisma.transaction.findMany({
      where: { status: { in: ["AUTHORIZED", "PENDING"] } },
      include: {
        booking: {
          select: {
            id: true,
            userName: true,
            userEmail: true,
            expertName: true,
            expertId: true,
            userId: true,
            paidAt: true,
            stripePaymentIntentId: true,
            totalPrice: true,
            paidAmount: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    })

    const holds: {
      bookingId: string
      transactionId: string
      shugyoName: string
      shugyoUserId: string
      takumiName: string
      takumiExpertId: string
      amountCents: number
      authDate: string | null
      daysUntilExpiry: number | null
      expiryStatus: "ok" | "warning" | "critical"
      paymentType: "stripe" | "wallet"
    }[] = []

    const now = Date.now()
    const MS_PER_DAY = 86400 * 1000

    for (const tx of authorizedTxs) {
      const b = tx.booking
      if (!b) continue
      const amountCents = tx.totalAmount
      const isWallet = b.stripePaymentIntentId === "wallet"
      let daysUntilExpiry: number | null = null
      let expiryStatus: "ok" | "warning" | "critical" = "ok"

      if (isWallet) {
        // Wallet: no Stripe expiry, treat as stable
        daysUntilExpiry = null
        expiryStatus = "ok"
      } else if (b.paidAt) {
        const authMs = new Date(b.paidAt).getTime()
        const daysSinceAuth = (now - authMs) / MS_PER_DAY
        daysUntilExpiry = Math.max(0, Math.floor(STRIPE_HOLD_DAYS - daysSinceAuth))
        if (daysUntilExpiry <= 0 || daysSinceAuth >= 6) expiryStatus = "critical" // Red: ≥6 days or expired
        else if (daysSinceAuth >= 4) expiryStatus = "warning" // Yellow: 4–6 days
      }

      holds.push({
        bookingId: b.id,
        transactionId: tx.id,
        shugyoName: b.userName,
        shugyoUserId: b.userId,
        takumiName: b.expertName,
        takumiExpertId: b.expertId,
        amountCents,
        authDate: b.paidAt?.toISOString() ?? null,
        daysUntilExpiry,
        expiryStatus,
        paymentType: isWallet ? "wallet" : "stripe",
      })
    }

    // Total Shugyo wallet balances (liability)
    const shugyoWalletSum = await prisma.user.aggregate({
      where: { appRole: "shugyo" },
      _sum: { balance: true },
    })
    const totalShugyoWalletCents = shugyoWalletSum._sum.balance ?? 0

    return NextResponse.json({
      holds,
      totalShugyoWalletCents,
      stripeHoldDays: STRIPE_HOLD_DAYS,
    })
  } catch (err) {
    console.error("[admin/finance/summary] Error:", err)
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 })
  }
}

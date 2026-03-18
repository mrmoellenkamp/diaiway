import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getVisionConfigStatus } from "@/lib/vision-safety"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/health-check
 * Admin-only. Returns live DB checks for health dashboard.
 */
export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  try {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)

    const [
      cronLogs,
      stripeAtRisk,
      walletUsers,
      walletSums,
      availableTakumis,
      availableWithoutPush,
    ] = await Promise.all([
      prisma.cronRunLog.findMany({
        where: { cronName: { in: ["release-wallet", "experts-offline"] } },
        select: { cronName: true, lastRunAt: true },
      }),
      prisma.booking.findMany({
        where: {
          paymentStatus: "paid",
          paidAt: { lt: sixDaysAgo },
          transaction: {
            status: { in: ["AUTHORIZED", "PENDING"] },
          },
        },
        include: {
          transaction: { select: { id: true, status: true } },
          user: { select: { name: true } },
          expert: { select: { name: true } },
        },
        orderBy: { paidAt: "asc" },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { walletTransactions: { some: {} } },
            { balance: { not: 0 } },
          ],
        },
        select: { id: true, name: true, balance: true },
      }),
      prisma.walletTransaction.groupBy({
        by: ["userId"],
        _sum: { amountCents: true },
      }),
      prisma.expert.count({
        where: { liveStatus: "available" },
      }),
      prisma.expert.count({
        where: {
          liveStatus: "available",
          OR: [
            { userId: null },
            { user: { pushSubscriptions: { none: {} }, fcmTokens: { none: {} } } },
          ],
        },
      }),
    ])

    const cronMap = Object.fromEntries(cronLogs.map((c) => [c.cronName, c.lastRunAt.toISOString()]))

    const walletIntegrity = walletUsers.map((u) => {
      const sum = walletSums.find((s) => s.userId === u.id)?._sum?.amountCents ?? 0
      const balance = u.balance
      const diff = sum - balance
      const hasDiscrepancy = diff !== 0
      return {
        userId: u.id,
        userName: u.name,
        balanceCents: balance,
        sumWalletTxCents: sum,
        diffCents: diff,
        hasDiscrepancy,
      }
    }).filter((w) => w.hasDiscrepancy)

    const pushReachPct =
      availableTakumis > 0
        ? Math.round((availableWithoutPush / availableTakumis) * 100)
        : 0

    const visionConfig = getVisionConfigStatus()

    return NextResponse.json({
      visionConfig,
      cronMonitor: {
        "release-wallet": cronMap["release-wallet"] ?? null,
        "experts-offline": cronMap["experts-offline"] ?? null,
      },
      stripeEscrow: stripeAtRisk.map((b) => ({
        bookingId: b.id,
        userName: b.userName,
        expertName: b.expertName,
        paidAt: b.paidAt?.toISOString() ?? null,
        transactionId: b.transaction?.id,
        transactionStatus: b.transaction?.status,
      })),
      walletIntegrity,
      pushReachability: {
        availableTakumis,
        availableWithoutPush,
        percentWithoutPush: pushReachPct,
      },
    })
  } catch (err) {
    console.error("[admin/health-check] Error:", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Health-Check fehlgeschlagen." },
      { status: 500 }
    )
  }
}

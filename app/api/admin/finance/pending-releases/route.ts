import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/admin/finance/pending-releases
 * Transaktionen mit Status AUTHORIZED/PENDING, deren Buchung completed ist.
 * Diese warten auf Freigabe (Shugyo oder 24h-Cron) – Admin kann als Override freigeben.
 */
export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  try {
    const pending = await prisma.transaction.findMany({
      where: {
        status: { in: ["AUTHORIZED", "PENDING"] },
        booking: {
          status: "completed",
          sessionEndedAt: { not: null },
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            userName: true,
            userEmail: true,
            expertName: true,
            date: true,
            startTime: true,
            endTime: true,
            sessionEndedAt: true,
            stripePaymentIntentId: true,
          },
        },
      },
    })

    const items = pending.map((t) => ({
      id: t.id,
      bookingId: t.bookingId,
      totalAmount: t.totalAmount,
      platformFee: t.platformFee,
      netPayout: t.netPayout,
      status: t.status,
      createdAt: t.createdAt?.toISOString() ?? null,
      userName: t.booking?.userName ?? null,
      userEmail: t.booking?.userEmail ?? null,
      expertName: t.booking?.expertName ?? null,
      date: t.booking?.date ?? null,
      startTime: t.booking?.startTime ?? null,
      endTime: t.booking?.endTime ?? null,
      sessionEndedAt: t.booking?.sessionEndedAt?.toISOString() ?? null,
      stripePaymentIntentId: t.booking?.stripePaymentIntentId ?? null,
    }))

    return NextResponse.json({ items })
  } catch (err) {
    console.error("[admin/finance/pending-releases] Error:", err)
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 })
  }
}

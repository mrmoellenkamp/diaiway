import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/admin/finance
 * Alle Transactions mit Buchungs- und Nutzerdaten für das Admin-Finanz-Dashboard.
 * KPIs: Netto-Provision, USt-Schätzung, offene Takumi-Auszahlungen.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const taxFilter = searchParams.get("tax") // "" | "privat" | "unternehmen"
  const statusFilter = searchParams.get("status") // "" | "CAPTURED" | "REFUNDED" | ...

  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          select: {
            userName: true,
            userEmail: true,
            expertName: true,
            date: true,
            stripePaymentIntentId: true,
            paidAt: true,
            sessionStartedAt: true,
            sessionEndedAt: true,
          },
        },
        user: {
          select: { invoiceData: true, email: true, name: true },
        },
        expert: {
          select: { name: true, email: true, user: true },
        },
      },
    })

    // Takumi-Bilanz (Summe aller Takumi-Guthaben)
    const takumiBalances = await prisma.user.aggregate({
      where: { appRole: "takumi" },
      _sum: { balance: true },
    })
    const openTakumiPayouts = takumiBalances._sum.balance ?? 0

    // KPIs aus CAPTURED Transactions (serverseitig aggregiert)
    const captured = transactions.filter((t) => t.status === "CAPTURED")
    const totalPlatformFee = captured.reduce((s, t) => s + t.platformFee, 0)

    // Stripe-Gebühren (EU: 1,4 % + 0,25 € pro erfolgreicher Kartenzahlung; Wallet = 0)
    let totalStripeFeeCents = 0
    for (const t of captured) {
      const isWallet = t.booking?.stripePaymentIntentId === "wallet"
      if (!isWallet && t.booking?.stripePaymentIntentId) {
        totalStripeFeeCents += Math.round(t.totalAmount * 0.014) + 25
      }
    }
    const netPlatformFeeAfterStripeCents = Math.max(0, totalPlatformFee - totalStripeFeeCents)

    // USt-Schätzung (Reseller-Modell: nur wo wir Steuerschuldner sind, d.h. B2C ohne reverse charge)
    // Bei Unternehmen (USt-IdNr.): reverse charge → 0. Bei Privat: 19/119 der Provision.
    let collectedVatCents = 0
    for (const t of captured) {
      const invData = t.user?.invoiceData as { type?: string } | null
      const isBusiness = invData?.type === "unternehmen"
      if (!isBusiness) {
        collectedVatCents += Math.round(t.platformFee * (19 / 119))
      }
    }

    // Filter anwenden
    let filtered = transactions
    if (taxFilter === "privat" || taxFilter === "unternehmen") {
      filtered = filtered.filter((t) => {
        const inv = t.user?.invoiceData as { type?: string } | null
        return (inv?.type ?? "privat") === taxFilter
      })
    }
    if (statusFilter) {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

    const kpis = {
      totalPlatformFeeCents: totalPlatformFee,
      stripeFeeCents: totalStripeFeeCents,
      netPlatformFeeAfterStripeCents,
      collectedVatCents,
      openTakumiPayoutsCents: openTakumiPayouts,
    }

    const items = filtered.map((t) => {
      const invData = t.user?.invoiceData as { type?: string; vatId?: string } | null
      const isBusiness = invData?.type === "unternehmen"
      return {
        id: t.id,
        bookingId: t.bookingId,
        status: t.status,
        totalAmount: t.totalAmount,
        platformFee: t.platformFee,
        netPayout: t.netPayout,
        invoiceNumber: t.invoiceNumber,
        creditNoteNumber: t.creditNoteNumber,
        invoicePdfUrl: t.invoicePdfUrl,
        creditNotePdfUrl: t.creditNotePdfUrl,
        stornoInvoicePdfUrl: t.stornoInvoicePdfUrl,
        stornoCreditNotePdfUrl: t.stornoCreditNotePdfUrl,
        completedAt: t.completedAt,
        invoiceEmailSentAt: t.invoiceEmailSentAt,
        creditNoteEmailSentAt: t.creditNoteEmailSentAt,
        createdAt: t.createdAt,
        userName: t.booking?.userName ?? t.user?.name,
        userEmail: t.booking?.userEmail ?? t.user?.email,
        expertName: t.booking?.expertName ?? t.expert?.name,
        expertEmail: t.expert?.email,
        date: t.booking?.date,
        shugyoInvoiceData: t.user?.invoiceData,
        vatId: invData?.vatId ?? null,
        isBusiness,
        paidAt: t.booking?.paidAt?.toISOString() ?? null,
        sessionStartedAt: t.booking?.sessionStartedAt?.toISOString() ?? null,
        sessionEndedAt: t.booking?.sessionEndedAt?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ kpis, transactions: items })
  } catch (err) {
    console.error("[admin/finance] Error:", err)
    return NextResponse.json({ error: "Fehler beim Laden der Finanzdaten." }, { status: 500 })
  }
}

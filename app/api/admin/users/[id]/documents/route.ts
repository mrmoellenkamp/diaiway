import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return { error: "Nicht autorisiert." as const, status: 401 as const }
  }
  return { session }
}

type DocItem = {
  id: string
  type: "rechnung" | "gutschrift" | "storno_rechnung" | "storno_gutschrift" | "wallet_rechnung"
  label: string
  number: string | null
  date: string
  amountCents: number | null
  url: string
  role: "shugyo" | "takumi"
  referenceId?: string
}

/**
 * GET /api/admin/users/[id]/documents
 * Admin: Alle systemseitigen Belege mit offizieller Rechnungsanschrift für diesen Nutzer.
 * Rechnungen (Shugyo), Gutschriften (Takumi), Wallet-Aufladungen.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id: userId } = await params
  if (!userId) return NextResponse.json({ error: "User-ID fehlt." }, { status: 400 })

  try {
    const expert = await prisma.expert.findUnique({
      where: { userId },
      select: { id: true },
    })

    const [txAsShugyo, txAsTakumi, walletTopups] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          booking: { select: { date: true } },
        },
      }),
      expert
        ? prisma.transaction.findMany({
            where: { expertId: expert.id },
            orderBy: { createdAt: "desc" },
            include: {
              booking: { select: { date: true } },
            },
          })
        : Promise.resolve([]),
      prisma.walletTransaction.findMany({
        where: { userId, type: "topup" },
        orderBy: { createdAt: "desc" },
      }),
    ])

    const docs: DocItem[] = []

    for (const t of txAsShugyo) {
      const date = t.booking?.date ?? t.createdAt.toISOString().slice(0, 10)
      if (t.invoicePdfUrl) {
        docs.push({
          id: `tx-${t.id}-re`,
          type: "rechnung",
          label: "Rechnung (RE)",
          number: t.invoiceNumber ?? null,
          date,
          amountCents: t.totalAmount,
          url: t.invoicePdfUrl,
          role: "shugyo",
          referenceId: t.bookingId,
        })
      }
      if (t.stornoInvoicePdfUrl) {
        docs.push({
          id: `tx-${t.id}-sr`,
          type: "storno_rechnung",
          label: "Storno-Rechnung (SR)",
          number: t.stornoInvoiceNumber ?? null,
          date,
          amountCents: t.totalAmount,
          url: t.stornoInvoicePdfUrl,
          role: "shugyo",
          referenceId: t.bookingId,
        })
      }
    }

    for (const t of txAsTakumi) {
      const date = t.booking?.date ?? t.createdAt.toISOString().slice(0, 10)
      if (t.creditNotePdfUrl) {
        docs.push({
          id: `tx-${t.id}-gs`,
          type: "gutschrift",
          label: "Gutschrift (GS)",
          number: t.creditNoteNumber ?? null,
          date,
          amountCents: t.netPayout,
          url: t.creditNotePdfUrl,
          role: "takumi",
          referenceId: t.bookingId,
        })
      }
      if (t.stornoCreditNotePdfUrl) {
        docs.push({
          id: `tx-${t.id}-sg`,
          type: "storno_gutschrift",
          label: "Storno-Gutschrift (SG)",
          number: t.stornoCreditNoteNumber ?? null,
          date,
          amountCents: t.netPayout,
          url: t.stornoCreditNotePdfUrl,
          role: "takumi",
          referenceId: t.bookingId,
        })
      }
    }

    for (const wt of walletTopups) {
      const meta = (wt.metadata as { invoiceNumber?: string; invoicePdfUrl?: string } | null) ?? {}
      if (meta.invoicePdfUrl) {
        docs.push({
          id: `wt-${wt.id}`,
          type: "wallet_rechnung",
          label: "Wallet-Aufladung (RE)",
          number: meta.invoiceNumber ?? null,
          date: wt.createdAt.toISOString().slice(0, 10),
          amountCents: wt.amountCents,
          url: meta.invoicePdfUrl,
          role: "shugyo",
        })
      }
    }

    docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ documents: docs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[admin/documents] Error:", msg, err)
    return NextResponse.json(
      { error: "Fehler beim Laden der Belege.", detail: process.env.NODE_ENV === "development" ? msg : undefined },
      { status: 500 }
    )
  }
}

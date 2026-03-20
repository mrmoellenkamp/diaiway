import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/admin/finance/audit-log
 * Combined stream: Transactions + WalletTransactions for audit.
 * referenceId links to Shugyo/Takumi profiles.
 * Admin only.
 */
export async function GET(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)))

  try {
    const [transactions, walletTx, adminActions] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          booking: { select: { userName: true, expertName: true } },
          user: { select: { id: true, name: true } },
          expert: { select: { id: true, userId: true } },
        },
      }),
      prisma.walletTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: { id: true, name: true, appRole: true } } },
      }),
      prisma.adminActionLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ])

    type AuditItem = {
      id: string
      type: "transaction" | "wallet" | "admin_action"
      createdAt: string
      amountCents?: number
      status?: string
      description: string
      referenceId: string | null
      profileUrl: string | null
      paymentType?: string
    }

    const items: AuditItem[] = []

    for (const t of transactions) {
      const refId = t.userId
      items.push({
        id: t.id,
        type: "transaction",
        createdAt: t.createdAt.toISOString(),
        amountCents: t.totalAmount,
        status: t.status,
        description: `${t.booking?.userName ?? t.user?.name} → ${t.booking?.expertName ?? "-"} · ${t.status}`,
        referenceId: refId,
        profileUrl: `/user/${refId}`,
      })
    }

    for (const w of walletTx) {
      const refId = w.referenceId ?? w.userId
      const sign = w.amountCents >= 0 ? "+" : ""
      items.push({
        id: w.id,
        type: "wallet",
        createdAt: w.createdAt.toISOString(),
        amountCents: w.amountCents,
        description: `${w.user.name} · ${w.type} ${sign}${(w.amountCents / 100).toFixed(2)} €`,
        referenceId: refId,
        profileUrl: `/user/${w.userId}`,
        paymentType: w.type,
      })
    }

    for (const a of adminActions) {
      items.push({
        id: a.id,
        type: "admin_action",
        createdAt: a.createdAt.toISOString(),
        description: `Admin: ${a.action} · ${a.targetType} ${a.targetId}`,
        referenceId: a.targetId,
        profileUrl: null,
      })
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const auditItems = items.slice(0, limit)

    return NextResponse.json({ items: auditItems })
  } catch (err) {
    console.error("[admin/finance/audit-log] Error:", err)
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 })
  }
}

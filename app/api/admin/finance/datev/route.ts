import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/admin/finance/datev?from=YYYY-MM-DD&to=YYYY-MM-DD
 * CSV-Export für DATEV / Steuerberater.
 * Format: Datum;Betrag;USt-Schlüssel;Gegenkonto;Buchungstext
 * - USt-Schlüssel: 10 = 19 % (Standard), 0 = reverse charge / keine USt
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) {
    return NextResponse.json(
      { error: "Parameter from und to (YYYY-MM-DD) erforderlich." },
      { status: 400 }
    )
  }

  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Ungültiges Datumsformat." }, { status: 400 })
  }
  toDate.setHours(23, 59, 59, 999)

  const maxDays = 93
  const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > maxDays) {
    return NextResponse.json(
      { error: `Maximal ${maxDays} Tage (ca. 3 Monate) pro Export.` },
      { status: 400 }
    )
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        status: { in: ["CAPTURED", "REFUNDED"] },
        completedAt: { gte: fromDate, lte: toDate },
      },
      include: {
        booking: { select: { userName: true, expertName: true, date: true } },
        user: { select: { invoiceData: true, name: true } },
      },
    })

    const rows: string[] = []
    rows.push("Datum;Betrag;USt-Schlüssel;Gegenkonto;Buchungstext")

    for (const t of transactions) {
      const invData = t.user?.invoiceData as { type?: string } | null
      const isBusiness = invData?.type === "unternehmen"
      const vatKey = isBusiness ? "0" : "10"
      const text = `${t.booking?.userName ?? ""} → ${t.booking?.expertName ?? ""} ${t.invoiceNumber ?? ""}`.trim()

      // Gegenkonto: 8400 = Erlöse 19% USt (B2C), 8337 = Reverse Charge (B2B)
      const konto = isBusiness ? "8337" : "8400"
      if (t.status === "CAPTURED") {
        const dateStr = t.completedAt?.toISOString().slice(0, 10) ?? t.booking?.date ?? ""
        const amount = (t.platformFee / 100).toFixed(2).replace(".", ",")
        rows.push(`${dateStr};${amount};${vatKey};${konto};${text}`)
      } else if (t.status === "REFUNDED" && t.stornoInvoiceNumber) {
        const dateStr = t.updatedAt.toISOString().slice(0, 10)
        const amount = (-t.platformFee / 100).toFixed(2).replace(".", ",")
        rows.push(`${dateStr};${amount};${vatKey};${konto};Storno ${t.stornoInvoiceNumber} ${text}`)
      }
    }

    const csv = rows.join("\n")
    const bom = "\uFEFF"
    const filename = `diaiway_datev_${from}_${to}.csv`

    return new NextResponse(bom + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[admin/finance/datev] Error:", err)
    return NextResponse.json({ error: "DATEV-Export fehlgeschlagen." }, { status: 500 })
  }
}

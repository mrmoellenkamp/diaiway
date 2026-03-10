import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import JSZip from "jszip"

/**
 * GET /api/admin/finance/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Exportiert Rechnungen und Gutschriften als ZIP für den angegebenen Zeitraum.
 * Nur CAPTURED Transaktionen mit completedAt im Bereich.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") // YYYY-MM-DD
  const to = searchParams.get("to") // YYYY-MM-DD

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
      { error: `Maximal ${maxDays} Tage (ca. 3 Monate) pro Export. Bitte Zeitraum verkürzen.` },
      { status: 400 }
    )
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        status: "CAPTURED",
        completedAt: { gte: fromDate, lte: toDate },
      },
      include: {
        booking: { select: { userName: true, expertName: true, date: true } },
      },
    })

    const zip = new JSZip()

    for (const t of transactions) {
      const dateStr = t.booking?.date ?? t.completedAt?.toISOString().slice(0, 10) ?? "unknown"
      const baseName = `${dateStr}_${t.invoiceNumber ?? t.id}`
      if (t.invoicePdfUrl) {
        try {
          const res = await fetch(t.invoicePdfUrl)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            zip.file(`Rechnung_${baseName}.pdf`, buf)
          }
        } catch (e) {
          console.warn("[finance/export] Invoice fetch failed:", t.invoicePdfUrl, e)
        }
      }
      if (t.creditNotePdfUrl) {
        try {
          const res = await fetch(t.creditNotePdfUrl)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            zip.file(`Gutschrift_${baseName}.pdf`, buf)
          }
        } catch (e) {
          console.warn("[finance/export] Credit note fetch failed:", t.creditNotePdfUrl, e)
        }
      }
    }

    const blob = await zip.generateAsync({ type: "nodebuffer" })
    const filename = `diaiway_finance_${from}_${to}.zip`

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[admin/finance/export] Error:", err)
    return NextResponse.json({ error: "Export fehlgeschlagen." }, { status: 500 })
  }
}

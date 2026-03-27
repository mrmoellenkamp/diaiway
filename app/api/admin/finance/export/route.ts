import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import JSZip from "jszip"

const UTF8_BOM = "\uFEFF"
const MAX_DAYS = 93

/** Escape CSV field for semicolon delimiter; wrap in quotes if needed */
function csvEscape(val: string): string {
  const s = String(val ?? "").replace(/"/g, '""')
  if (/[;\n\r"]/.test(s)) return `"${s}"`
  return s
}

/** Format date as YYYY-MM-DD HH:mm */
function formatCsVDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${day} ${h}:${min}`
}

/** Cents to decimal string (e.g. 1990 → "19.90") */
function centsToDecimal(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2)
}

const CSV_HEADER = [
  "Date",
  "Transaction Type",
  "Reference ID",
  "Shugyo ID",
  "Shugyo Name",
  "Takumi ID",
  "Takumi Name",
  "Gross Amount",
  "Currency",
  "Payment Status",
].join(";")

/**
 * GET /api/admin/finance/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=zip|csv
 * format=zip (default): Rechnungen/Gutschriften als ZIP
 * format=csv: DATEV-ready CSV mit Stripe Captures + Wallet DEBIT/CREDIT
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
  const format = searchParams.get("format") ?? "zip"

  if (!from || !to) {
    return NextResponse.json(
      { error: "Parameter from und to (YYYY-MM-DD) erforderlich." },
      { status: 400 }
    )
  }

  const fromDate = new Date(from + "T00:00:00Z")
  const toDate = new Date(to + "T23:59:59.999Z")
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Ungültiges Datumsformat." }, { status: 400 })
  }

  const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > MAX_DAYS) {
    return NextResponse.json(
      { error: `Maximal ${MAX_DAYS} Tage (ca. 3 Monate) pro Export.` },
      { status: 400 }
    )
  }

  try {
    if (format === "csv") {
      return await handleCsvExport(fromDate, toDate, from, to, session.user.id)
    }
    return await handleZipExport(fromDate, toDate, from, to)
  } catch (err) {
    console.error("[admin/finance/export] Error:", err)
    return NextResponse.json({ error: "Export fehlgeschlagen." }, { status: 500 })
  }
}

async function handleCsvExport(
  fromDate: Date,
  toDate: Date,
  fromStr: string,
  toStr: string,
  adminId: string
): Promise<NextResponse> {
  const [capturedTxs, walletTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        status: "CAPTURED",
        completedAt: { gte: fromDate, lte: toDate },
      },
      include: {
        booking: {
          select: {
            id: true,
            userName: true,
            expertName: true,
            userId: true,
            expertId: true,
          },
        },
        user: { select: { id: true, name: true } },
        expert: { select: { id: true, userId: true, name: true } },
      },
    }),
    prisma.walletTransaction.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
      },
      include: { user: { select: { id: true, name: true, appRole: true } } },
    }),
  ])

  type CsvRow = {
    date: string
    txType: string
    refId: string
    shugyoId: string
    shugyoName: string
    takumiId: string
    takumiName: string
    grossAmount: string
    currency: string
    paymentStatus: string
  }

  const rows: CsvRow[] = []

  for (const t of capturedTxs) {
    const shugyoId = t.booking?.userId ?? t.userId ?? ""
    const shugyoName = t.booking?.userName ?? t.user?.name ?? "(gelöscht)"
    const takumiUserId = t.expert?.userId ?? ""
    const takumiId = (takumiUserId || t.expertId) ?? ""
    const takumiName = t.booking?.expertName ?? t.expert?.name ?? "(gelöscht)"
    rows.push({
      date: formatCsVDate(t.completedAt ?? t.createdAt),
      txType: "Stripe_Capture",
      refId: t.bookingId,
      shugyoId,
      shugyoName,
      takumiId,
      takumiName,
      grossAmount: centsToDecimal(t.totalAmount),
      currency: "EUR",
      paymentStatus: "SUCCEEDED",
    })
  }

  const bookingIds = [...new Set(walletTxs.map((w) => w.referenceId).filter(Boolean) as string[])]
  const [bookings, experts] = bookingIds.length > 0
    ? await Promise.all([
        prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, expertId: true, expertName: true, userId: true, userName: true },
        }),
        prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { expertId: true },
        }).then((bs) => {
          const ids = [...new Set(bs.map((x) => x.expertId).filter(Boolean))] as string[]
          return ids.length
            ? prisma.expert.findMany({
                where: { id: { in: ids } },
                select: { id: true, userId: true },
              })
            : []
        }),
      ])
    : [[], []]
  const bookingMap = Object.fromEntries(bookings.map((b) => [b.id, b]))
  const expertMap = Object.fromEntries(experts.map((e) => [e.id, e.userId ?? ""]))

  for (const w of walletTxs) {
    const isDebit = w.amountCents < 0
    let txType: string
    if (isDebit) {
      txType = w.type === "booking_payment" ? "Wallet_Debit" : `Wallet_${w.type}`
    } else {
      txType = w.type === "refund" ? "Wallet_Refund" : w.type === "topup" ? "Wallet_Topup" : "Wallet_Credit"
    }
    let shugyoId = ""
    let shugyoName = ""
    let takumiId = ""
    let takumiName = ""
    const b = w.referenceId ? bookingMap[w.referenceId] : null
    if (b) {
      shugyoId = b.userId ?? ""
      shugyoName = b.userName ?? "(gelöscht)"
      takumiId = expertMap[b.expertId] ?? ""
      takumiName = b.expertName ?? "(gelöscht)"
    } else {
      shugyoId = w.user?.appRole === "shugyo" ? w.userId : ""
      shugyoName = w.user?.appRole === "shugyo" ? (w.user?.name ?? "(gelöscht)") : ""
      takumiId = w.user?.appRole === "takumi" ? w.userId : ""
      takumiName = w.user?.appRole === "takumi" ? (w.user?.name ?? "(gelöscht)") : ""
    }
    rows.push({
      date: formatCsVDate(w.createdAt),
      txType,
      refId: w.referenceId ?? w.id,
      shugyoId: shugyoId || "-",
      shugyoName: shugyoName || "-",
      takumiId: takumiId || "-",
      takumiName: takumiName || "-",
      grossAmount: centsToDecimal(w.amountCents),
      currency: "EUR",
      paymentStatus: "SUCCEEDED",
    })
  }

  rows.sort((a, b) => a.date.localeCompare(b.date))

  const csvLines = [CSV_HEADER, ...rows.map((r) =>
    [
      csvEscape(r.date),
      csvEscape(r.txType),
      csvEscape(r.refId),
      csvEscape(r.shugyoId),
      csvEscape(r.shugyoName),
      csvEscape(r.takumiId),
      csvEscape(r.takumiName),
      csvEscape(r.grossAmount),
      csvEscape(r.currency),
      csvEscape(r.paymentStatus),
    ].join(";")
  )]

  const csvBody = UTF8_BOM + csvLines.join("\r\n")
  const filename = `diaiway_export_${fromStr}_${toStr}.csv`

  await prisma.adminActionLog.create({
    data: {
      adminId,
      action: "finance_export_csv",
      targetType: "date_range",
      targetId: `${fromStr}_${toStr}`,
      details: { rowCount: rows.length },
    },
  })

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

async function handleZipExport(
  fromDate: Date,
  toDate: Date,
  from: string,
  to: string
): Promise<NextResponse> {
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
}

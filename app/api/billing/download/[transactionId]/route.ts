import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const VALID_TYPES = ["invoice", "credit", "storno-invoice", "storno-credit"] as const

/**
 * GET /api/billing/download/[transactionId]?type=invoice|credit|storno-invoice|storno-credit
 *
 * Liefert den Beleg (PDF) nur wenn der Nutzer berechtigt ist:
 * - Rechnung / Storno-Rechnung: Shugyo (Zahler / booking.userId)
 * - Gutschrift / Storno-Gutschrift: Takumi (Expert)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent(req.url)
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
    )
  }

  const { transactionId } = await params
  const type = req.nextUrl.searchParams.get("type") as (typeof VALID_TYPES)[number] | null

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Ungültiger Typ. Verwende type=invoice, credit, storno-invoice oder storno-credit." },
      { status: 400 }
    )
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { booking: { include: { expert: true } } },
  })

  if (!tx) {
    return NextResponse.json({ error: "Transaktion nicht gefunden." }, { status: 404 })
  }

  const expertUserId = tx.booking.expert?.userId
  const isShugyo = tx.userId === session.user.id
  const isTakumi = expertUserId === session.user.id

  let pdfUrl: string | null = null
  let filename = "beleg.pdf"

  if (type === "invoice") {
    if (!isShugyo) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Rechnung." }, { status: 403 })
    }
    pdfUrl = tx.invoicePdfUrl
    filename = tx.invoiceNumber ? `Rechnung-${tx.invoiceNumber}.pdf` : "Rechnung.pdf"
  } else if (type === "credit") {
    if (!isTakumi) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Gutschrift." }, { status: 403 })
    }
    pdfUrl = tx.creditNotePdfUrl
    filename = tx.creditNoteNumber ? `Gutschrift-${tx.creditNoteNumber}.pdf` : "Gutschrift.pdf"
  } else if (type === "storno-invoice") {
    if (!isShugyo) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Storno-Rechnung." }, { status: 403 })
    }
    pdfUrl = tx.stornoInvoicePdfUrl
    filename = tx.stornoInvoiceNumber ? `Storno-Rechnung-${tx.stornoInvoiceNumber}.pdf` : "Storno-Rechnung.pdf"
  } else if (type === "storno-credit") {
    if (!isTakumi) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Storno-Gutschrift." }, { status: 403 })
    }
    pdfUrl = tx.stornoCreditNotePdfUrl
    filename = tx.stornoCreditNoteNumber ? `Storno-Gutschrift-${tx.stornoCreditNoteNumber}.pdf` : "Storno-Gutschrift.pdf"
  }

  if (!pdfUrl) {
    return NextResponse.json(
      { error: "Beleg für diesen Typ ist nicht vorhanden." },
      { status: 404 }
    )
  }

  try {
    const res = await fetch(pdfUrl)
    if (!res.ok) {
      console.error("[billing/download] Blob fetch failed:", res.status, pdfUrl)
      return NextResponse.json(
        { error: "Beleg konnte nicht geladen werden." },
        { status: 502 }
      )
    }
    const blob = await res.arrayBuffer()
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[billing/download] Error streaming PDF:", err)
    return NextResponse.json(
      { error: "Beleg konnte nicht abgerufen werden." },
      { status: 500 }
    )
  }
}

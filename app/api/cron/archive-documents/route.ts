import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { assertCronAuthorized } from "@/lib/cron-auth"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron: archive-documents (täglich 01:00 UTC)
 *
 * Archiviert alle PDF-Belege aus abgeschlossenen Transaktionen in DocumentArchive.
 * Aufbewahrungsfristen:
 *   - Rechnungen (RE), Gutschriften (GS), Provisionsrechnungen (PR): 10 Jahre (§§ 147 AO, 257 HGB)
 *   - Storno-Belege (SR, SG): 10 Jahre
 *   - Wallet-Belege (GBL): 6 Jahre (§ 257 HGB – Buchungsbeleg)
 *
 * Idempotent: Bereits archivierte Einträge (gleiche transactionId + docType) werden
 * nicht erneut angelegt (upsert-Logik via unique check).
 */
export async function GET(req: NextRequest) {
  const authErr = assertCronAuthorized(req, "archive-documents")
  if (authErr) return authErr

  const now = new Date()
  let archived = 0
  let skipped = 0

  // ── 1. Transaction-PDFs archivieren ────────────────────────────────────────
  const transactions = await prisma.transaction.findMany({
    where: {
      status: { in: ["CAPTURED", "REFUNDED"] },
    },
    select: {
      id: true,
      userId: true,
      expertId: true,
      invoiceNumber: true,
      invoicePdfUrl: true,
      creditNoteNumber: true,
      creditNotePdfUrl: true,
      commissionInvoiceNumber: true,
      commissionInvoicePdfUrl: true,
      stornoInvoiceNumber: true,
      stornoInvoicePdfUrl: true,
      stornoCreditNoteNumber: true,
      stornoCreditNotePdfUrl: true,
    },
  })

  const docEntries: Array<{
    transactionId: string
    docType: string
    docNumber: string
    blobUrl: string
    userId?: string
    expertId?: string
    retentionYears: number
  }> = []

  for (const tx of transactions) {
    if (tx.invoicePdfUrl && tx.invoiceNumber) {
      docEntries.push({
        transactionId: tx.id,
        docType: "invoice",
        docNumber: tx.invoiceNumber,
        blobUrl: tx.invoicePdfUrl,
        userId: tx.userId ?? undefined,
        expertId: tx.expertId ?? undefined,
        retentionYears: 10,
      })
    }
    if (tx.creditNotePdfUrl && tx.creditNoteNumber) {
      docEntries.push({
        transactionId: tx.id,
        docType: "credit_note",
        docNumber: tx.creditNoteNumber,
        blobUrl: tx.creditNotePdfUrl,
        expertId: tx.expertId ?? undefined,
        retentionYears: 10,
      })
    }
    if (tx.commissionInvoicePdfUrl && tx.commissionInvoiceNumber) {
      docEntries.push({
        transactionId: tx.id,
        docType: "commission",
        docNumber: tx.commissionInvoiceNumber,
        blobUrl: tx.commissionInvoicePdfUrl,
        expertId: tx.expertId ?? undefined,
        retentionYears: 10,
      })
    }
    if (tx.stornoInvoicePdfUrl && tx.stornoInvoiceNumber) {
      docEntries.push({
        transactionId: tx.id,
        docType: "storno_invoice",
        docNumber: tx.stornoInvoiceNumber,
        blobUrl: tx.stornoInvoicePdfUrl,
        userId: tx.userId ?? undefined,
        retentionYears: 10,
      })
    }
    if (tx.stornoCreditNotePdfUrl && tx.stornoCreditNoteNumber) {
      docEntries.push({
        transactionId: tx.id,
        docType: "storno_credit",
        docNumber: tx.stornoCreditNoteNumber,
        blobUrl: tx.stornoCreditNotePdfUrl,
        expertId: tx.expertId ?? undefined,
        retentionYears: 10,
      })
    }
  }

  // ── 2. Wallet-Belege (GBL) archivieren ────────────────────────────────────
  const walletReceipts = await prisma.walletTransaction.findMany({
    where: {
      type: "topup",
      metadata: { not: undefined },
    },
    select: {
      id: true,
      userId: true,
      metadata: true,
    },
  })

  for (const wt of walletReceipts) {
    const meta = wt.metadata as Record<string, unknown> | null
    const receiptUrl = meta?.receiptPdfUrl as string | undefined
    const receiptNumber = meta?.receiptNumber as string | undefined
    if (receiptUrl && receiptNumber) {
      docEntries.push({
        transactionId: wt.id,
        docType: "wallet_receipt",
        docNumber: receiptNumber,
        blobUrl: receiptUrl,
        userId: wt.userId ?? undefined,
        retentionYears: 6,
      })
    }
  }

  // ── 3. In DocumentArchive eintragen (nur neue) ────────────────────────────
  for (const entry of docEntries) {
    const exists = await prisma.documentArchive.findFirst({
      where: { transactionId: entry.transactionId, docType: entry.docType },
      select: { id: true },
    })
    if (exists) {
      skipped++
      continue
    }
    const retainUntil = new Date(now)
    retainUntil.setFullYear(retainUntil.getFullYear() + entry.retentionYears)

    await prisma.documentArchive.create({
      data: {
        transactionId: entry.transactionId,
        docType: entry.docType,
        docNumber: entry.docNumber,
        blobUrl: entry.blobUrl,
        userId: entry.userId ?? null,
        expertId: entry.expertId ?? null,
        retentionYears: entry.retentionYears,
        retainUntil,
      },
    })
    archived++
  }

  await prisma.cronRunLog.upsert({
    where: { cronName: "archive-documents" },
    create: { cronName: "archive-documents", lastRunAt: now },
    update: { lastRunAt: now },
  })

  console.log(`[Cron/archive-documents] Archived: ${archived}, Skipped (already archived): ${skipped}`)
  return NextResponse.json({ ok: true, archived, skipped })
}

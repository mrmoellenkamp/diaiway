"use server"

import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { getNextDocumentNumber, ensureCustomerNumber } from "@/lib/billing"
import { put } from "@vercel/blob"
import { generateInvoicePdf, generateCreditNotePdf } from "@/lib/pdf-invoice"

const PLATFORM_FEE_PERCENT = 15
const RELEASE_DELAY_HOURS = 24

/**
 * Verarbeitet den Abschluss einer Buchung (Hold & Capture Modell).
 * - Stripe: capture des PaymentIntents
 * - Generiert RE (Rechnung) und GS (Gutschrift)
 * - Gutschreibt netPayout dem Takumi-Wallet
 *
 * Sollte aufgerufen werden, wenn die Session als completed markiert wurde
 * (z.B. durch Cron oder nach Ablauf der 24h-Phase).
 */
export async function processCompletion(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: { include: { user: true } }, user: true },
  })
  if (!booking) return { ok: false, error: "Booking not found" }
  if (booking.status !== "completed") return { ok: false, error: "Booking ist noch nicht abgeschlossen" }

  const tx = await prisma.transaction.findUnique({
    where: { bookingId },
  })
  if (!tx) return { ok: false, error: "Keine Transaktion für diese Buchung" }
  if (tx.status !== "AUTHORIZED" && tx.status !== "PENDING")
    return { ok: false, error: "Transaktion bereits verarbeitet" }

  const expertUserId = booking.expert?.userId
  if (!expertUserId) return { ok: false, error: "Expert hat keinen User" }

  try {
    // 1. Stripe Capture (falls Kartenzahlung)
    if (booking.stripePaymentIntentId && booking.stripePaymentIntentId !== "wallet") {
      const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId)
      if (pi.status === "requires_capture") {
        await stripe.paymentIntents.capture(booking.stripePaymentIntentId)
      } else if (pi.status !== "succeeded") {
        return { ok: false, error: `Stripe PaymentIntent Status: ${pi.status}` }
      }
    }

    // 2. Belegnummern vergeben
    const [invoiceNumber, creditNoteNumber] = await Promise.all([
      getNextDocumentNumber("RE"),
      getNextDocumentNumber("GS"),
    ])

    // 3. Kundennummern sicherstellen
    await ensureCustomerNumber(booking.userId)
    const shugyo = await prisma.user.findUnique({
      where: { id: booking.userId },
      select: { customerNumber: true, invoiceData: true },
    })

    const now = new Date()

    // 4. PDF-Generierung
    const invoiceBuf = await generateInvoicePdf({
      invoiceNumber,
      recipientName: booking.userName,
      recipientEmail: booking.userEmail,
      bookingId,
      expertName: booking.expertName,
      totalAmountCents: tx.totalAmount,
      date: now,
    })
    const creditBuf = await generateCreditNotePdf({
      creditNumber: creditNoteNumber,
      recipientName: booking.expert!.name,
      recipientEmail: booking.expert!.email || "",
      bookingId,
      netPayoutCents: tx.netPayout,
      platformFeeCents: tx.platformFee,
      totalAmountCents: tx.totalAmount,
      date: now,
    })

    const [invoiceBlob, creditBlob] = await Promise.all([
      put(`invoices/${tx.id}-${invoiceNumber}.pdf`, Buffer.from(invoiceBuf), { access: "public" }),
      put(`invoices/${tx.id}-${creditNoteNumber}.pdf`, Buffer.from(creditBuf), { access: "public" }),
    ])

    // 5. DB-Update: Transaction CAPTURED, Takumi-Guthaben
    const isWalletPayment = booking.stripePaymentIntentId === "wallet"
    await prisma.$transaction(async (db) => {
      if (isWalletPayment) {
        await db.user.update({
          where: { id: expertUserId },
          data: {
            pendingBalance: { decrement: tx.totalAmount },
            balance: { increment: tx.netPayout },
          },
        })
      } else {
        await db.user.update({
          where: { id: expertUserId },
          data: { balance: { increment: tx.netPayout } },
        })
      }
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          status: "CAPTURED",
          invoiceNumber,
          creditNoteNumber,
          invoicePdfUrl: invoiceBlob.url,
          creditNotePdfUrl: creditBlob.url,
          completedAt: now,
        },
      })
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[processCompletion] Error:", msg)
    return { ok: false, error: msg }
  }
}

/**
 * Cron: Findet abgeschlossene Buchungen, deren Session 24h zurückliegt,
 * und ruft processCompletion auf.
 */
export async function processPendingCompletions() {
  const cutoff = new Date(Date.now() - RELEASE_DELAY_HOURS * 60 * 60 * 1000)

  const pending = await prisma.transaction.findMany({
    where: { status: { in: ["AUTHORIZED", "PENDING"] } },
    include: { booking: true },
  })

  const toProcess = pending.filter((t) => {
    const ended = t.booking.sessionEndedAt
    return ended && ended <= cutoff && t.booking.status === "completed"
  })

  const results: { bookingId: string; ok: boolean; error?: string }[] = []
  for (const t of toProcess) {
    const res = await processCompletion(t.bookingId)
    results.push({ bookingId: t.bookingId, ok: res.ok, error: res.error })
  }
  return results
}

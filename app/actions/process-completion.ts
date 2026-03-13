"use server"

import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { markVerified } from "@/lib/verification-service"
import { getNextDocumentNumber, ensureCustomerNumber } from "@/lib/billing"
import { put } from "@vercel/blob"
import { generateInvoicePdf, generateCreditNotePdf } from "@/lib/pdf-invoice"
import { sendInvoiceReadyEmail, sendCreditNoteReadyEmail } from "@/lib/email"
import { getBillingDownloadUrl } from "@/lib/billing-download"

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

    // 3. Kundennummern sicherstellen (Shugyo + Takumi)
    await Promise.all([
      ensureCustomerNumber(booking.userId),
      ensureCustomerNumber(expertUserId),
    ])
    const [shugyo, takumiUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: booking.userId },
        select: { customerNumber: true, invoiceData: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: expertUserId },
        select: { invoiceData: true },
      }),
    ])

    const now = new Date()

    // 4. PDF-Generierung
    const durationMin = booking.sessionDuration ?? (() => {
      if (booking.startTime && booking.endTime) {
        const [sh, sm] = booking.startTime.split(":").map(Number)
        const [eh, em] = booking.endTime.split(":").map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      }
      return 30
    })()

    const shugyoInvoiceData = shugyo?.invoiceData as { type?: string } | null
    const takumiInvoiceData = takumiUser?.invoiceData as { type?: string } | null
    const shugyoIsGeschaeftskunde = shugyoInvoiceData?.type === "unternehmen"
    const takumiIsGeschaeftskunde = takumiInvoiceData?.type === "unternehmen"

    const invoiceBuf = await generateInvoicePdf({
      invoiceNumber,
      recipientName: booking.userName,
      recipientEmail: booking.userEmail,
      bookingId,
      expertName: booking.expertName,
      totalAmountCents: tx.totalAmount,
      date: now,
      durationMinutes: durationMin,
      useZugferd: shugyoIsGeschaeftskunde,
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
      useZugferd: takumiIsGeschaeftskunde,
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

    // 6. E-Mail-Versand: Rechnung an Shugyo, Gutschrift an Takumi
    const invoiceDownloadUrl = getBillingDownloadUrl(tx.id, "invoice")
    const creditDownloadUrl = getBillingDownloadUrl(tx.id, "credit")

    const shugyoEmail = (
      booking.userEmail?.trim() ||
      (booking.user as { email?: string } | null)?.email?.trim() ||
      shugyo?.email?.trim() ||
      ""
    ).toLowerCase()
    if (!shugyoEmail || !shugyoEmail.includes("@")) {
      console.warn(`[processCompletion] Keine gültige E-Mail für Shugyo (${booking.userName}). Rechnung kann nicht per E-Mail versendet werden. Nutzer-ID: ${booking.userId}`)
    }

    const invoiceEmailPromise = shugyoEmail && shugyoEmail.includes("@")
      ? sendInvoiceReadyEmail({
          to: shugyoEmail,
          userName: booking.userName,
      downloadUrl: invoiceDownloadUrl,
      isBusiness: shugyoIsGeschaeftskunde,
      invoiceNumber,
      expertName: booking.expertName,
      date: booking.date,
    })
      : Promise.resolve({ sent: false, error: "Keine gültige E-Mail-Adresse für Shugyo" })

    const takumiEmail = booking.expert!.email?.trim()
    const creditEmailPromise = takumiEmail
      ? sendCreditNoteReadyEmail({
          to: takumiEmail,
          takumiName: booking.expert!.name,
          downloadUrl: creditDownloadUrl,
          isBusiness: takumiIsGeschaeftskunde,
          creditNoteNumber,
          userName: booking.userName,
          date: booking.date,
        })
      : Promise.resolve({ sent: false, error: "Keine E-Mail-Adresse" })

    const [invoiceEmail, creditEmail] = await Promise.all([invoiceEmailPromise, creditEmailPromise])

    if (invoiceEmail.sent) {
      console.log(`[processCompletion] Rechnung ${invoiceNumber} per E-Mail an ${shugyoEmail} versendet. Link: ${invoiceDownloadUrl}`)
    } else {
      console.warn(`[processCompletion] Rechnungs-E-Mail für ${booking.userName} fehlgeschlagen (E-Mail: ${shugyoEmail || "keine"}):`, invoiceEmail.error)
    }
    if (creditEmail.sent) {
      console.log(`[processCompletion] Gutschrift ${creditNoteNumber} per E-Mail an ${takumiEmail} versendet. Link: ${creditDownloadUrl}`)
    } else if (takumiEmail) {
      console.warn(`[processCompletion] Gutschriften-E-Mail an ${takumiEmail} fehlgeschlagen:`, creditEmail.error)
    } else {
      console.log(`[processCompletion] Gutschrift ${creditNoteNumber}: Keine E-Mail-Adresse für Takumi, übersprungen.`)
    }

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        ...(invoiceEmail.sent && { invoiceEmailSentAt: now }),
        ...(creditEmail.sent && { creditNoteEmailSentAt: now }),
      },
    })

    // Shugyo-Verifizierung durch Aktivität: 3 abgeschlossene Sessions (Case B)
    const shugyoId = booking.userId
    if (shugyoId) {
      const completedCount = await prisma.booking.count({
        where: { userId: shugyoId, status: "completed" },
      })
      if (completedCount >= 3) {
        await markVerified(shugyoId, "ACTIVITY").catch(() => {})
      }
    }

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

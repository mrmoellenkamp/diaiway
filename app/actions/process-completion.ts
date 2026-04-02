"use server"

import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { markVerified } from "@/lib/verification-service"
import { getNextDocumentNumber, ensureCustomerNumber } from "@/lib/billing"
import { put } from "@vercel/blob"
import { generateInvoicePdf, generateCreditNotePdf, generateCommissionInvoicePdf } from "@/lib/pdf-invoice"
import { sendInvoiceReadyEmail, sendCreditNoteReadyEmail, sendCommissionInvoiceEmail } from "@/lib/email"
import { getBillingDownloadUrl } from "@/lib/billing-download"
import { greetingPartsFromInvoiceData, invoiceDataCountry, resolveTakumiVatStatus } from "@/lib/invoice-requirements"
import { sendPushToUser } from "@/lib/push"
import { pushT } from "@/lib/push-strings"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"

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
    include: { expert: { include: { user: true } }, user: true, transaction: true },
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
  if (!booking.userId) return { ok: false, error: "Buchungsabschluss nur für registrierte Nutzer (keine Gast-Calls)" }

  try {
    // 1. Stripe Capture – nur nötig wenn Takumi kein Connect-Konto hat (Fallback: Hold & Capture)
    // Bei Stripe Connect (application_fee + transfer_data) ist der PaymentIntent bereits "succeeded"
    if (booking.stripePaymentIntentId && booking.stripePaymentIntentId !== "wallet") {
      const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId)
      if (pi.status === "requires_capture") {
        // Fallback: kein Connect-Konto → manuell capturen
        await stripe.paymentIntents.capture(booking.stripePaymentIntentId)
      } else if (pi.status !== "succeeded") {
        return { ok: false, error: `Stripe PaymentIntent Status: ${pi.status}` }
      }
      // pi.status === "succeeded": Connect-Zahlung bereits verarbeitet, nichts zu tun
    }

    // 2. Belegnummern vergeben
    const isWalletPaymentCheck = booking.stripePaymentIntentId === "wallet"
    const isConnectPaymentCheck = !isWalletPaymentCheck &&
      !!(booking.expert?.stripeConnectAccountId) &&
      booking.expert?.stripeConnectStatus === "active"

    const docNumberPromises: Promise<string>[] = [
      getNextDocumentNumber("RE"),
      getNextDocumentNumber("GS"),
      getNextDocumentNumber("PR"),
    ]
    const docNumbers = await Promise.all(docNumberPromises)
    const [invoiceNumber, creditNoteNumber, commissionInvoiceNumber] = docNumbers

    // 3. Kundennummern sicherstellen (Shugyo + Takumi)
    await Promise.all([
      ensureCustomerNumber(booking.userId),
      ensureCustomerNumber(expertUserId),
    ])
    const [shugyo, takumiUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: booking.userId },
        select: { customerNumber: true, invoiceData: true, email: true, name: true, username: true },
      }),
      prisma.user.findUnique({
        where: { id: expertUserId },
        select: { customerNumber: true, invoiceData: true, name: true },
      }),
    ])

    const now = new Date()

    // 4. PDF-Generierung (Rechnungen/Gutschriften: echter Name aus invoiceData oder user.name)
    const durationMin = booking.sessionDuration ?? (() => {
      if (booking.startTime && booking.endTime) {
        const [sh, sm] = booking.startTime.split(":").map(Number)
        const [eh, em] = booking.endTime.split(":").map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      }
      return 30
    })()

    const shugyoInvoiceData = shugyo?.invoiceData as { type?: string; fullName?: string; companyName?: string } | null
    const takumiInvoiceData = takumiUser?.invoiceData as { type?: string; fullName?: string; companyName?: string } | null
    const shugyoIsGeschaeftskunde = shugyoInvoiceData?.type === "unternehmen"
    const takumiIsGeschaeftskunde = takumiInvoiceData?.type === "unternehmen"
    const takumiVatStatus = resolveTakumiVatStatus(takumiUser?.invoiceData)

    const shugyoRealName =
      (shugyoInvoiceData?.type === "unternehmen"
        ? shugyoInvoiceData?.companyName?.trim()
        : shugyoInvoiceData?.fullName?.trim()) || shugyo?.name || booking.userName
    const takumiRealName =
      (takumiInvoiceData?.type === "unternehmen"
        ? takumiInvoiceData?.companyName?.trim()
        : takumiInvoiceData?.fullName?.trim()) || takumiUser?.name || booking.expert!.name

    const introGreeting = greetingPartsFromInvoiceData(
      shugyo?.invoiceData,
      shugyo?.name ?? "",
      shugyo?.username
    )
    const invoiceBuf = await generateInvoicePdf({
      invoiceNumber,
      recipientName: shugyoRealName,
      recipientEmail: booking.userEmail,
      recipientCustomerNumber: shugyo?.customerNumber ?? null,
      recipientCountry: invoiceDataCountry(shugyo?.invoiceData),
      recipientInvoiceData: shugyo?.invoiceData,
      bookingId,
      expertName: booking.expertName,
      totalAmountCents: tx.totalAmount,
      date: now,
      durationMinutes: durationMin,
      useZugferd: shugyoIsGeschaeftskunde,
      introGreeting,
      takumiSenderName: takumiRealName,
      takumiVatStatus,
    })
    const creditBuf = await generateCreditNotePdf({
      creditNumber: creditNoteNumber,
      recipientName: takumiRealName,
      recipientEmail: booking.expert!.email || "",
      recipientCustomerNumber: takumiUser?.customerNumber ?? null,
      recipientCountry: invoiceDataCountry(takumiUser?.invoiceData),
      recipientInvoiceData: takumiUser?.invoiceData,
      bookingId,
      netPayoutCents: tx.netPayout,
      platformFeeCents: tx.platformFee,
      totalAmountCents: tx.totalAmount,
      date: now,
      useZugferd: takumiIsGeschaeftskunde,
      takumiVatStatus,
    })

    // Provisionsrechnung immer generieren (Connect + Wallet + Fallback)
    let commissionBuf: ArrayBuffer | null = null
    if (commissionInvoiceNumber) {
      commissionBuf = await generateCommissionInvoicePdf({
        invoiceNumber: commissionInvoiceNumber,
        recipientName: takumiRealName,
        recipientEmail: booking.expert!.email || "",
        recipientCustomerNumber: takumiUser?.customerNumber ?? null,
        recipientCountry: invoiceDataCountry(takumiUser?.invoiceData),
        recipientInvoiceData: takumiUser?.invoiceData,
        bookingId,
        totalAmountCents: tx.totalAmount,
        commissionCents: tx.platformFee,
        netPayoutCents: tx.netPayout,
        date: now,
        takumiVatStatus,
      })
    }

    const blobUploads: Promise<{ url: string }>[] = [
      put(`invoices/${tx.id}-${invoiceNumber}.pdf`, Buffer.from(invoiceBuf), { access: "public" }),
      put(`invoices/${tx.id}-${creditNoteNumber}.pdf`, Buffer.from(creditBuf), { access: "public" }),
    ]
    if (commissionBuf && commissionInvoiceNumber) {
      blobUploads.push(
        put(`invoices/${tx.id}-${commissionInvoiceNumber}.pdf`, Buffer.from(commissionBuf), { access: "public" })
      )
    }
    const blobResults = await Promise.all(blobUploads)
    const [invoiceBlob, creditBlob, commissionBlob] = blobResults

    // 5. DB-Update: Transaction CAPTURED, Takumi-Guthaben
    const isWalletPayment = booking.stripePaymentIntentId === "wallet"
    const isConnectPayment = isConnectPaymentCheck

    await prisma.$transaction(async (db) => {
      if (isWalletPayment) {
        await db.user.update({
          where: { id: expertUserId },
          data: {
            pendingBalance: { decrement: tx.totalAmount },
            balance: { increment: tx.netPayout },
          },
        })
      } else if (!isConnectPayment) {
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
          ...(commissionInvoiceNumber && commissionBlob ? {
            commissionInvoiceNumber,
            commissionInvoicePdfUrl: commissionBlob.url,
          } : {}),
          completedAt: now,
        },
      })
    })

    // 6a. In-App-Notification: Session abgeschlossen (für Shugyo)
    if (booking.userId) {
      try {
        const uloc = await getUserPreferredLocale(booking.userId)
        const title = pushT(uloc, "sessionCompletedTitle")
        const body = pushT(uloc, "sessionCompletedBody", { takumiName: booking.expertName })
        await prisma.notification.create({
          data: { userId: booking.userId, type: "session_completed", bookingId, title, body },
        })
        sendPushToUser(booking.userId, { title, body, url: "/sessions?tab=past", pushType: "GENERAL" }).catch(() => {})
      } catch { /* notification errors must not block */ }
    }

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
      console.warn(`[processCompletion] Keine gültige Shugyo-E-Mail vorhanden. Rechnung kann nicht versendet werden. bookingId=${booking.id}`)
    }

    const invoiceEmailPromise = shugyoEmail && shugyoEmail.includes("@")
      ? sendInvoiceReadyEmail({
          to: shugyoEmail,
          userName: shugyoRealName,
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
          userName: shugyoRealName,
          date: booking.date,
        })
      : Promise.resolve({ sent: false, error: "Keine E-Mail-Adresse" })

    // Provisionsrechnung-E-Mail (immer)
    const commissionEmailPromise = (commissionInvoiceNumber && commissionBlob && takumiEmail)
      ? sendCommissionInvoiceEmail({
          to: takumiEmail,
          takumiName: booking.expert!.name,
          downloadUrl: getBillingDownloadUrl(tx.id, "commission"),
          invoiceNumber: commissionInvoiceNumber,
          userName: shugyoRealName,
          date: booking.date,
          commissionCents: tx.platformFee,
          netPayoutCents: tx.netPayout,
        })
      : Promise.resolve({ sent: false, error: "Kein Connect oder keine E-Mail" })

    const [invoiceEmail, creditEmail, commissionEmail] = await Promise.all([
      invoiceEmailPromise,
      creditEmailPromise,
      commissionEmailPromise,
    ])

    if (invoiceEmail.sent) {
      console.log(`[processCompletion] Rechnung ${invoiceNumber} versendet.`)
    } else {
      console.warn(`[processCompletion] Rechnungs-E-Mail fehlgeschlagen (${shugyoEmail ? "Empfänger vorhanden" : "keine E-Mail"}):`, invoiceEmail.error)
    }
    if (creditEmail.sent) {
      console.log(`[processCompletion] Gutschrift ${creditNoteNumber} versendet.`)
    } else if (takumiEmail) {
      console.warn(`[processCompletion] Gutschriften-E-Mail fehlgeschlagen:`, creditEmail.error)
    }
    if (commissionEmail.sent) {
      console.log(`[processCompletion] Provisionsrechnung ${commissionInvoiceNumber} versendet.`)
    }

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        ...(invoiceEmail.sent && { invoiceEmailSentAt: now }),
        ...(creditEmail.sent && { creditNoteEmailSentAt: now }),
        ...(commissionEmail.sent && { commissionInvoiceEmailSentAt: now }),
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

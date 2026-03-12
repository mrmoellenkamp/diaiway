"use server"

import { put } from "@vercel/blob"
import { prisma } from "@/lib/db"
import { getNextDocumentNumber } from "@/lib/billing"
import {
  generateCreditNotePdf,
  generateInvoicePdf,
  generateStornoCreditNotePdf,
  generateStornoInvoicePdf,
  generateWalletTopupInvoicePdf,
} from "@/lib/pdf-invoice"

const PLATFORM_FEE_PERCENT = 15

/**
 * Wallet aufladen (nach erfolgreicher Stripe-Zahlung).
 * Idempotent bei Webhook-Wiederholung (prüft stripeSessionId).
 */
export async function creditWalletTopup(
  userId: string,
  amountCents: number,
  stripeSessionId: string
): Promise<{ ok: boolean; error?: string }> {
  if (amountCents <= 0) return { ok: false, error: "Betrag muss positiv sein" }

  try {
    const existing = await prisma.walletTransaction.findFirst({
      where: { userId, referenceId: stripeSessionId, type: "topup" },
    })
    if (existing) return { ok: true } // Idempotenz

    const wtId = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: amountCents } },
      })
      const wt = await tx.walletTransaction.create({
        data: {
          userId,
          amountCents,
          type: "topup",
          referenceId: stripeSessionId,
        },
      })
      return wt.id
    })

    // Rechnung für Wallet-Aufladung erstellen
    try {
      const [user, invoiceNumber] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }),
        getNextDocumentNumber("RE"),
      ])
      if (user) {
        const now = new Date()
        const buf = await generateWalletTopupInvoicePdf({
          invoiceNumber,
          recipientName: user.name,
          recipientEmail: user.email,
          amountCents,
          date: now,
        })
        const blob = await put(`invoices/wallet-${wtId}-${invoiceNumber}.pdf`, Buffer.from(buf), {
          access: "public",
        })
        await prisma.walletTransaction.update({
          where: { id: wtId },
          data: {
            metadata: { invoiceNumber, invoicePdfUrl: blob.url },
          },
        })
      }
    } catch (err) {
      console.error("[creditWalletTopup] Invoice generation failed:", err)
      // Topup war erfolgreich, Rechnung fehlgeschlagen — loggen, aber nicht fehlschlagen
    }

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[creditWalletTopup] Error:", msg)
    return { ok: false, error: msg }
  }
}

/**
 * Atomar Betrag vom Wallet abziehen.
 * Für Instant-Connect und andere Belastungen.
 */
export async function deductFromWallet(
  userId: string,
  amountCents: number,
  opts?: { type?: string; referenceId?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (amountCents <= 0) return { ok: false, error: "Betrag muss positiv sein" }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      })
      if (!user) return { ok: false as const, error: "User nicht gefunden" }
      if (user.balance < amountCents) return { ok: false as const, error: "Insufficient wallet balance" }

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amountCents } },
      })
      await tx.walletTransaction.create({
        data: {
          userId,
          amountCents: -amountCents,
          type: opts?.type ?? "deduction",
          referenceId: opts?.referenceId ?? undefined,
        },
      })
      return { ok: true as const }
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[deductFromWallet] Error:", msg)
    return { ok: false, error: msg }
  }
}

/**
 * Schritt 1: Authorization (Hold & Capture Modell)
 * Wenn ein Shugyo zahlt, wird das Geld bei Stripe reserviert (capture_method: manual).
 * Wir erstellen eine Transaction mit status AUTHORIZED. Das Guthaben wird dem Takumi
 * erst bei processCompletion (Capture) gutgeschrieben.
 */
export async function onPaymentReceived(bookingId: string, totalAmountCents: number) {
  const existing = await prisma.transaction.findUnique({ where: { bookingId } })
  if (existing) return existing // Idempotenz bei Webhook-Wiederholung

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })
  if (!booking) throw new Error("Booking not found")
  if (!booking.expert?.userId) throw new Error("Expert has no user")

  const platformFee = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100))
  const netPayout = totalAmountCents - platformFee

  const t = await prisma.transaction.create({
    data: {
      bookingId,
      expertId: booking.expertId,
      userId: booking.userId,
      totalAmount: totalAmountCents,
      platformFee,
      netPayout,
      status: "AUTHORIZED", // Hold: Stripe reserviert, noch nicht eingezogen
    },
  })
  return t
}

/**
 * Bezahlung einer Buchung mit Wallet-Guthaben (Shugyo).
 * Atomar: Balance-Guard verhindert negatives Guthaben; WalletTransaction für Audit.
 */
export async function payBookingWithWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.transaction.findUnique({ where: { bookingId } })
  if (existing) return { ok: true } // Bereits bezahlt (Idempotenz)

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })
  if (!booking) return { ok: false, error: "Booking not found" }
  if (booking.paymentStatus === "paid") return { ok: true }
  const expertUserId = booking.expert?.userId
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  const totalAmountCents = Math.round(
    (Number(booking.totalPrice ?? booking.price ?? 0)) * 100
  )
  if (totalAmountCents <= 0) return { ok: false, error: "Invalid price" }

  const platformFee = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100))
  const netPayout = totalAmountCents - platformFee

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic balance deduction with guard: only update if balance >= amount (race-condition safe)
      const updateResult = await tx.user.updateMany({
        where: {
          id: booking.userId,
          balance: { gte: totalAmountCents },
        },
        data: { balance: { decrement: totalAmountCents } },
      })

      if (updateResult.count === 0) {
        throw new Error("INSUFFICIENT_FUNDS")
      }

      await tx.user.update({
        where: { id: expertUserId },
        data: { pendingBalance: { increment: totalAmountCents } }, // Escrow bis processCompletion
      })

      await tx.transaction.create({
        data: {
          bookingId,
          expertId: booking.expertId,
          userId: booking.userId,
          totalAmount: totalAmountCents,
          platformFee,
          netPayout,
          status: "AUTHORIZED", // Wallet: Escrow in pendingBalance, Capture bei processCompletion
        },
      })

      await tx.walletTransaction.create({
        data: {
          userId: booking.userId,
          amountCents: -totalAmountCents, // DEBIT (negative = Belastung)
          type: "booking_payment",
          referenceId: bookingId,
          metadata: { bookingId, type: "DEBIT" },
        },
      })

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "paid",
          stripePaymentIntentId: "wallet",
          paidAt: new Date(),
          paidAmount: totalAmountCents,
        },
      })
    })
    return { ok: true }
  } catch (err) {
    if ((err as Error)?.message === "INSUFFICIENT_FUNDS") {
      return { ok: false, error: "INSUFFICIENT_FUNDS" }
    }
    throw err
  }
}

/**
 * Instant-Call: Belastet Shugyo-Wallet nach Session-Ende.
 * Kosten = (Dauer - kostenlose Phase) × Preis/Min. Erstellt Transaction AUTHORIZED.
 */
export async function chargeInstantCallToWallet(
  bookingId: string,
  durationMin: number,
  pricePerMinuteCents: number
): Promise<{ ok: boolean; amountCents?: number; error?: string }> {
  const FREE_MIN = 0.5 // Instant Connect: immer 30 Sek gratis
  const billingMin = Math.max(0, durationMin - FREE_MIN)
  const amountCents = Math.round(billingMin * pricePerMinuteCents) || 0

  if (amountCents <= 0) return { ok: true, amountCents: 0 }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: true },
  })
  if (!booking) return { ok: false, error: "Booking not found" }
  if (booking.paymentStatus === "paid") return { ok: true, amountCents }
  const expertUserId = booking.expert?.userId
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  const shugyo = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { balance: true },
  })
  if (!shugyo || shugyo.balance < amountCents) {
    return { ok: false, error: "Insufficient wallet balance", amountCents }
  }

  const platformFee = Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100))
  const netPayout = amountCents - platformFee

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: booking.userId },
      data: { balance: { decrement: amountCents } },
    })
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { increment: amountCents } },
    })
    await tx.transaction.create({
      data: {
        bookingId,
        expertId: booking.expertId,
        userId: booking.userId,
        totalAmount: amountCents,
        platformFee,
        netPayout,
        status: "AUTHORIZED",
      },
    })
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: "paid",
        stripePaymentIntentId: "wallet",
        paidAt: new Date(),
        paidAmount: amountCents,
      },
    })
  })
  return { ok: true, amountCents }
}

/**
 * Rückerstattung als Wallet-Guthaben (statt Auszahlung).
 * Betrag wird dem Shugyo gutgeschrieben, Takumi's pendingBalance wird freigegeben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } }, booking: true },
  })
  if (!t) return { ok: true }
  const reversable = ["AUTHORIZED", "PENDING", "CAPTURED", "COMPLETED"]
  if (!reversable.includes(t.status)) return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  const isWallet = t.booking?.stripePaymentIntentId === "wallet"
  const wasCaptured = t.status === "CAPTURED" || t.status === "COMPLETED"
  const newStatus = wasCaptured ? "REFUNDED" : "CANCELED"

  let stornoInvoiceNumber: string | null = null
  let stornoCreditNoteNumber: string | null = null
  let stornoInvoicePdfUrl: string | null = null
  let stornoCreditNotePdfUrl: string | null = null

  if (wasCaptured && t.invoiceNumber && t.creditNoteNumber && t.booking) {
    const [srNum, sgNum] = await Promise.all([
      getNextDocumentNumber("SR"),
      getNextDocumentNumber("SG"),
    ])
    const now = new Date()
    const srBuf = generateStornoInvoicePdf({
      stornoNumber: srNum,
      originalInvoiceNumber: t.invoiceNumber,
      recipientName: t.booking.userName,
      recipientEmail: t.booking.userEmail,
      bookingId: t.bookingId,
      expertName: t.booking.expertName,
      totalAmountCents: t.totalAmount,
      date: now,
    })
    const sgBuf = generateStornoCreditNotePdf({
      stornoNumber: sgNum,
      originalCreditNoteNumber: t.creditNoteNumber,
      recipientName: t.expert?.name ?? "",
      recipientEmail: t.expert?.email ?? "",
      bookingId: t.bookingId,
      netPayoutCents: t.netPayout,
      platformFeeCents: t.platformFee,
      totalAmountCents: t.totalAmount,
      date: now,
    })
    const [srBlob, sgBlob] = await Promise.all([
      put(`invoices/${t.id}-${srNum}.pdf`, Buffer.from(srBuf), { access: "public" }),
      put(`invoices/${t.id}-${sgNum}.pdf`, Buffer.from(sgBuf), { access: "public" }),
    ])
    stornoInvoiceNumber = srNum
    stornoCreditNoteNumber = sgNum
    stornoInvoicePdfUrl = srBlob.url
    stornoCreditNotePdfUrl = sgBlob.url
  }

  await prisma.$transaction(async (tx) => {
    const isPreCapture = t.status === "AUTHORIZED" || t.status === "PENDING"
    if (isPreCapture && isWallet) {
      await tx.user.update({
        where: { id: expertUserId },
        data: { pendingBalance: { decrement: t.totalAmount } },
      })
    } else if (wasCaptured) {
      await tx.user.update({
        where: { id: expertUserId },
        data: { balance: { decrement: t.netPayout } },
      })
    }
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: {
        status: newStatus,
        ...(stornoInvoiceNumber && {
          stornoInvoiceNumber,
          stornoCreditNoteNumber,
          stornoInvoicePdfUrl,
          stornoCreditNotePdfUrl,
        }),
      },
    })
  })
  return { ok: true }
}

/**
 * Release reservation for handshake (< 5 min): revert wallet amount to Shugyo balance.
 * Used when session ends before handshake limit; equivalent to creditRefundToShugyoWallet
 * for pre-capture wallet payments.
 */
export async function releaseReservation(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  return creditRefundToShugyoWallet(bookingId)
}

/**
 * Refund bei Buchungsstornierung (nach erfolgreichem Stripe-Refund).
 * Wird von der Buchungs-API aufgerufen, wenn User/Expert storniert und Stripe refunded.
 */
export async function refundTransactionForBooking(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } }, booking: true },
  })
  if (!t) return { ok: true }
  const reversable = ["AUTHORIZED", "PENDING", "CAPTURED", "COMPLETED"]
  if (!reversable.includes(t.status)) return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  const isWallet = t.booking?.stripePaymentIntentId === "wallet"
  const wasCaptured = t.status === "CAPTURED" || t.status === "COMPLETED"
  const newStatus = wasCaptured ? "REFUNDED" : "CANCELED"

  let stornoInvoiceNumber: string | null = null
  let stornoCreditNoteNumber: string | null = null
  let stornoInvoicePdfUrl: string | null = null
  let stornoCreditNotePdfUrl: string | null = null

  if (wasCaptured && t.invoiceNumber && t.creditNoteNumber && t.booking) {
    const [srNum, sgNum] = await Promise.all([
      getNextDocumentNumber("SR"),
      getNextDocumentNumber("SG"),
    ])
    const now = new Date()
    const srBuf = generateStornoInvoicePdf({
      stornoNumber: srNum,
      originalInvoiceNumber: t.invoiceNumber,
      recipientName: t.booking.userName,
      recipientEmail: t.booking.userEmail,
      bookingId: t.bookingId,
      expertName: t.booking.expertName,
      totalAmountCents: t.totalAmount,
      date: now,
    })
    const sgBuf = generateStornoCreditNotePdf({
      stornoNumber: sgNum,
      originalCreditNoteNumber: t.creditNoteNumber,
      recipientName: t.expert?.name ?? "",
      recipientEmail: t.expert?.email ?? "",
      bookingId: t.bookingId,
      netPayoutCents: t.netPayout,
      platformFeeCents: t.platformFee,
      totalAmountCents: t.totalAmount,
      date: now,
    })
    const [srBlob, sgBlob] = await Promise.all([
      put(`invoices/${t.id}-${srNum}.pdf`, Buffer.from(srBuf), { access: "public" }),
      put(`invoices/${t.id}-${sgNum}.pdf`, Buffer.from(sgBuf), { access: "public" }),
    ])
    stornoInvoiceNumber = srNum
    stornoCreditNoteNumber = sgNum
    stornoInvoicePdfUrl = srBlob.url
    stornoCreditNotePdfUrl = sgBlob.url
  }

  await prisma.$transaction(async (tx) => {
    const isPreCapture = t.status === "AUTHORIZED" || t.status === "PENDING"
    if (isPreCapture && isWallet) {
      await tx.user.update({
        where: { id: expertUserId },
        data: { pendingBalance: { decrement: t.totalAmount } },
      })
    } else if (wasCaptured) {
      await tx.user.update({
        where: { id: expertUserId },
        data: { balance: { decrement: t.netPayout } },
      })
    }
    await tx.transaction.update({
      where: { id: t.id },
      data: {
        status: newStatus,
        ...(stornoInvoiceNumber && {
          stornoInvoiceNumber,
          stornoCreditNoteNumber,
          stornoInvoicePdfUrl,
          stornoCreditNotePdfUrl,
        }),
      },
    })
  })
  return { ok: true }
}

/**
 * Schritt 3: Refund (Admin)
 * Bei berechtigten Reklamationen kann der Administrator den Betrag aus pendingBalance
 * an den Shugyo zurückerstatten. Stripe-Refund muss separat durchgeführt werden.
 */
export async function adminRefundFromPending(
  transactionId: string,
  stripeRefundCompleted: boolean
): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { expert: { include: { user: true } }, booking: true },
  })
  if (!t) return { ok: false, error: "Transaction not found" }
  const refundable = ["AUTHORIZED", "PENDING"]
  if (!refundable.includes(t.status)) return { ok: false, error: "Nur AUTHORIZED-Transaktionen können erstattet werden" }
  if (!stripeRefundCompleted) return { ok: false, error: "Stripe-Refund muss zuerst durchgeführt werden" }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "CANCELED" }, // Vor Capture storniert, kein SR/SG nötig
    })
  })
  return { ok: true }
}

/**
 * diaiway Safety Enforcement: Setzt die Transaktion einer Buchung auf ON_HOLD.
 * Pausiert den Stripe-Capture bis manuelle Prüfung durch Admin.
 */
export async function setTransactionOnHoldForBooking(bookingId: string): Promise<void> {
  await prisma.transaction.updateMany({
    where: { bookingId },
    data: { status: "ON_HOLD" },
  })
}

/**
 * Prüft, ob ein Takumi auszahlen kann (Stripe Connect verknüpft).
 */
export async function canTakumiWithdraw(userId: string): Promise<boolean> {
  const expert = await prisma.expert.findFirst({
    where: { userId },
    select: { stripeConnectAccountId: true },
  })
  return Boolean(expert?.stripeConnectAccountId?.trim())
}

/**
 * Transaktionshistorie für den Nutzer.
 * Enthält: Buchungen (paid/earned) + Wallet-Transaktionen (topup, deduction, refund).
 */
export async function getWalletHistory(userId: string, limit = 50) {
  const [asPayer, asExpert, walletTx] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { booking: { select: { expertName: true, date: true } } },
    }),
    prisma.expert.findFirst({ where: { userId }, select: { id: true } }).then((e) =>
      e
        ? prisma.transaction.findMany({
            where: { expertId: e.id },
            take: limit,
            orderBy: { createdAt: "desc" },
            include: { booking: { select: { userName: true, date: true } } },
          })
        : []
    ),
    prisma.walletTransaction.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ])
  const walletItems = walletTx.map((wt) => {
    const txType = wt.type === "topup" ? "topup" : wt.type === "refund" ? "refund" : "deduction"
    const meta = (wt.metadata as { invoiceNumber?: string; invoicePdfUrl?: string } | null) ?? {}
    return {
      id: wt.id,
      type: txType as "topup" | "deduction" | "refund",
      amount: wt.amountCents,
      status: "COMPLETED",
      bookingId: null as string | null,
      label:
        wt.type === "topup"
          ? "Wallet-Aufladung"
          : wt.type === "refund"
            ? "Rückerstattung"
            : "Belastung",
      date: new Date(wt.createdAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      createdAt: wt.createdAt,
      invoiceNumber: meta.invoiceNumber ?? null,
      invoicePdfUrl: meta.invoicePdfUrl ?? null,
      stornoInvoiceNumber: null,
      stornoInvoicePdfUrl: null,
      creditNoteNumber: null,
      creditNotePdfUrl: null,
      stornoCreditNoteNumber: null,
      stornoCreditNotePdfUrl: null,
    }
  })
  const combined = [
    ...asPayer.map((t) => ({
      id: t.id,
      type: "paid" as const,
      amount: -t.totalAmount,
      status: t.status,
      bookingId: t.bookingId,
      label: t.booking.expertName,
      date: t.booking.date,
      createdAt: t.createdAt,
      invoiceNumber: t.invoiceNumber,
      invoicePdfUrl: t.invoicePdfUrl,
      stornoInvoiceNumber: t.stornoInvoiceNumber,
      stornoInvoicePdfUrl: t.stornoInvoicePdfUrl,
      creditNoteNumber: null as string | null,
      creditNotePdfUrl: null as string | null,
      stornoCreditNoteNumber: null as string | null,
      stornoCreditNotePdfUrl: null as string | null,
    })),
    ...asExpert.map((t) => ({
      id: t.id,
      type: "earned" as const,
      amount: t.netPayout,
      status: t.status,
      bookingId: t.bookingId,
      label: t.booking.userName,
      date: t.booking.date,
      createdAt: t.createdAt,
      invoiceNumber: null as string | null,
      invoicePdfUrl: null as string | null,
      stornoInvoiceNumber: null as string | null,
      stornoInvoicePdfUrl: null as string | null,
      creditNoteNumber: t.creditNoteNumber,
      creditNotePdfUrl: t.creditNotePdfUrl,
      stornoCreditNoteNumber: t.stornoCreditNoteNumber,
      stornoCreditNotePdfUrl: t.stornoCreditNotePdfUrl,
    })),
    ...walletItems,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return combined.slice(0, limit)
}

/**
 * Holt die Wallet-Salden eines Takumi.
 */
export async function getTakumiWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, pendingBalance: true },
  })
  if (!user) return null
  const canWithdraw = await canTakumiWithdraw(userId)
  return {
    balance: user.balance,
    pendingBalance: user.pendingBalance,
    canWithdraw,
  }
}

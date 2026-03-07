"use server"

import { put } from "@vercel/blob"
import { prisma } from "@/lib/db"
import { generateCreditNotePdf, generateInvoicePdf } from "@/lib/pdf-invoice"

const PLATFORM_FEE_PERCENT = 15
const RELEASE_DELAY_HOURS = 24

/**
 * Schritt 1: Zahlungseingang
 * Wenn ein Shugyo bezahlt, wird der Betrag in pendingBalance des Takumi geparkt.
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

  const tx = await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        bookingId,
        expertId: booking.expertId,
        userId: booking.userId,
        totalAmount: totalAmountCents,
        platformFee,
        netPayout,
        status: "PENDING",
      },
    })
    await tx.user.update({
      where: { id: booking.expert.userId },
      data: { pendingBalance: { increment: totalAmountCents } },
    })
    return t
  })
  return tx
}

/**
 * Bezahlung einer Buchung mit Wallet-Guthaben (Shugyo).
 * Reduziert User.balance des Shugyo, erstellt Transaction, erhöht Takumi pendingBalance.
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
  if (!booking.expert?.userId) return { ok: false, error: "Expert has no user" }

  const totalAmountCents = Math.round((booking.price || 0) * 100)
  if (totalAmountCents <= 0) return { ok: false, error: "Invalid price" }

  const shugyo = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { balance: true },
  })
  if (!shugyo || shugyo.balance < totalAmountCents) {
    return { ok: false, error: "Insufficient wallet balance" }
  }

  const platformFee = Math.round(totalAmountCents * (PLATFORM_FEE_PERCENT / 100))
  const netPayout = totalAmountCents - platformFee

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: booking.userId },
      data: { balance: { decrement: totalAmountCents } },
    })
    await tx.user.update({
      where: { id: booking.expert.userId },
      data: { pendingBalance: { increment: totalAmountCents } },
    })
    await tx.transaction.create({
      data: {
        bookingId,
        expertId: booking.expertId,
        userId: booking.userId,
        totalAmount: totalAmountCents,
        platformFee,
        netPayout,
        status: "PENDING",
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
}

/**
 * Schritt 2: Freigabe nach Call
 * 24 Stunden nach einem als 'completed' markierten Call wird die platformFee (15%) abgezogen
 * und der Restbetrag von pendingBalance in das balance des Takumi verschoben.
 */
export async function releasePendingTransactions() {
  const cutoff = new Date(Date.now() - RELEASE_DELAY_HOURS * 60 * 60 * 1000)

  const pending = await prisma.transaction.findMany({
    where: { status: "PENDING" },
    include: {
      booking: true,
      expert: { include: { user: true } },
    },
  })

  const toRelease = pending.filter((t) => {
    const ended = t.booking.sessionEndedAt
    return ended && ended <= cutoff && t.booking.status === "completed"
  })

  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const t of toRelease) {
    try {
      const expertUserId = t.expert?.user?.id
      if (!expertUserId) {
        results.push({ id: t.id, ok: false, error: "Expert has no user" })
        continue
      }
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: expertUserId },
          data: {
            pendingBalance: { decrement: t.totalAmount },
            balance: { increment: t.netPayout },
          },
        })
        await tx.transaction.update({
          where: { id: t.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        })
      })

      // PDF-Generierung: Rechnung + Gutschrift
      try {
        const now = new Date()
        const invNum = `INV-${t.bookingId.slice(-8).toUpperCase()}-${now.getFullYear()}`
        const credNum = `GUT-${t.bookingId.slice(-8).toUpperCase()}-${now.getFullYear()}`

        const invoiceBuf = generateInvoicePdf({
          invoiceNumber: invNum,
          recipientName: t.booking.userName,
          recipientEmail: t.booking.userEmail,
          bookingId: t.bookingId,
          expertName: t.booking.expertName,
          totalAmountCents: t.totalAmount,
          date: now,
        })
        const creditBuf = generateCreditNotePdf({
          creditNumber: credNum,
          recipientName: t.expert.name,
          recipientEmail: t.expert.email || "",
          bookingId: t.bookingId,
          netPayoutCents: t.netPayout,
          platformFeeCents: t.platformFee,
          totalAmountCents: t.totalAmount,
          date: now,
        })

        const [invoiceBlob, creditBlob] = await Promise.all([
          put(`invoices/${t.id}-rechnung.pdf`, Buffer.from(invoiceBuf), { access: "public" }),
          put(`invoices/${t.id}-gutschrift.pdf`, Buffer.from(creditBuf), { access: "public" }),
        ])

        await prisma.transaction.update({
          where: { id: t.id },
          data: { invoicePdfUrl: invoiceBlob.url, creditNotePdfUrl: creditBlob.url },
        })
      } catch (pdfErr) {
        console.error("[Wallet] PDF generation failed for transaction:", t.id, pdfErr)
      }
      results.push({ id: t.id, ok: true })
    } catch (err) {
      results.push({
        id: t.id,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }
  return results
}

/**
 * Rückerstattung als Wallet-Guthaben (statt Auszahlung).
 * Betrag wird dem Shugyo gutgeschrieben, Takumi's pendingBalance wird freigegeben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Gutschrift (statt Auszahlung auf Karte).
 * Betrag wird dem Shugyo-Guthaben (User.balance) gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Refund bei Buchungsstornierung (nach erfolgreichem Stripe-Refund).
 * Wird von der Buchungs-API aufgerufen, wenn User/Expert storniert und Stripe refunded.
 */
export async function refundTransactionForBooking(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true } // Keine Transaction = nichts zu tun
  if (t.status !== "PENDING") return { ok: true } // Bereits verarbeitet

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Gutschrift (statt Auszahlung).
 * Betrag wird dem Shugyo-Guthaben (User.balance) gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Guthaben (Shugyo wählt "wallet").
 * Kein Stripe-Refund – Betrag wird dem Shugyo-Guthaben gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Guthaben (statt Stripe-Auszahlung).
 * Takumi pendingBalance wird reduziert, Shugyo balance erhöht.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Gutschrift (Shugyo wählt "wallet").
 * Kein Stripe-Refund – Betrag wird dem Shugyo-Guthaben gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Guthaben (Shugyo wählt "wallet").
 * Kein Stripe-Refund; Betrag wird dem Shugyo-Guthaben gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Gutschrift (Shugyo wählt "wallet").
 * Kein Stripe-Refund; Betrag wird dem Shugyo-Guthaben gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Guthaben (Shugyo wählt "wallet").
 * Kein Stripe-Refund; Betrag wird dem Shugyo-Balance gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Guthaben (Shugyo wählt "wallet").
 * Kein Stripe-Refund; Betrag wird dem Shugyo-Guthaben gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Guthaben (Shugyo wählt "wallet").
 * Kein Stripe-Refund; Betrag wird dem Shugyo-Balance gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Guthaben (Shugyo wählt "wallet").
 * Kein Stripe-Refund; Betrag wird dem Shugyo auf balance gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
}

/**
 * Rückerstattung als Wallet-Gutschrift (Shugyo wählt "wallet").
 * Kein Stripe-Refund — Betrag wird dem Shugyo-Guthaben gutgeschrieben.
 */
export async function creditRefundToShugyoWallet(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const t = await prisma.transaction.findUnique({
    where: { bookingId },
    include: { expert: { include: { user: true } } },
  })
  if (!t) return { ok: true }
  if (t.status !== "PENDING") return { ok: true }

  const expertUserId = t.expert?.user?.id
  if (!expertUserId) return { ok: false, error: "Expert has no user" }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: expertUserId },
      data: { pendingBalance: { decrement: t.totalAmount } },
    })
    await tx.user.update({
      where: { id: t.userId },
      data: { balance: { increment: t.totalAmount } },
    })
    await tx.transaction.update({
      where: { id: t.id },
      data: { status: "REFUNDED" },
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
  if (t.status !== "PENDING") return { ok: false, error: "Nur PENDING-Transaktionen können erstattet werden" }
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
      data: { status: "REFUNDED" },
    })
  })
  return { ok: true }
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
 * Als Shugyo: gezahlte Buchungen. Als Takumi: erhaltene Buchungen.
 */
export async function getWalletHistory(userId: string, limit = 50) {
  const [asPayer, asExpert] = await Promise.all([
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
  ])
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
      invoicePdfUrl: t.invoicePdfUrl,
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
      creditNotePdfUrl: t.creditNotePdfUrl,
    })),
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

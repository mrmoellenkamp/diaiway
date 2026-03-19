import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendInvoiceReadyEmail, sendCreditNoteReadyEmail } from "@/lib/email"
import { getBillingDownloadUrl } from "@/lib/billing-download"

/**
 * POST /api/admin/finance/resend-invoice
 * Admin: Rechnungs- und/oder Gutschriften-E-Mail erneut senden.
 * Body: { transactionId: string, type?: "invoice" | "credit" | "both" }
 */
export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  let body: { transactionId?: string; type?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const transactionId = body.transactionId?.trim()
  const type = (body.type || "both") as "invoice" | "credit" | "both"
  if (!transactionId) {
    return NextResponse.json({ error: "transactionId fehlt." }, { status: 400 })
  }

  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        booking: { include: { expert: true, user: true } },
        user: true,
        expert: true,
      },
    })
    if (!tx || !tx.booking) {
      return NextResponse.json({ error: "Transaktion nicht gefunden." }, { status: 404 })
    }

    const booking = tx.booking
    const shugyoEmail = (
      booking.userEmail?.trim() ||
      (booking.user as { email?: string } | null)?.email?.trim() ||
      (tx.user as { email?: string } | null)?.email?.trim() ||
      ""
    ).toLowerCase()
    const takumiUser = tx.expert?.userId
      ? await prisma.user.findUnique({
          where: { id: tx.expert.userId },
          select: { invoiceData: true, email: true },
        })
      : null

    const takumiEmail = (
      booking.expertEmail?.trim() ||
      booking.expert?.email?.trim() ||
      takumiUser?.email?.trim() ||
      ""
    ).toLowerCase()

    const shugyoInvoiceData = tx.user?.invoiceData as { type?: string; fullName?: string; companyName?: string } | null
    const shugyoIsGeschaeftskunde = shugyoInvoiceData?.type === "unternehmen"
    const takumiIsGeschaeftskunde = (takumiUser?.invoiceData as { type?: string } | null)?.type === "unternehmen"

    const shugyoRealName =
      (shugyoInvoiceData?.type === "unternehmen"
        ? shugyoInvoiceData?.companyName?.trim()
        : shugyoInvoiceData?.fullName?.trim()) || (tx.user as { name?: string })?.name || booking.userName

    const invoiceUrl = getBillingDownloadUrl(tx.id, "invoice")
    const creditUrl = getBillingDownloadUrl(tx.id, "credit")

    const results: { invoice?: { sent: boolean; error?: string }; credit?: { sent: boolean; error?: string } } = {}

    if ((type === "invoice" || type === "both") && tx.invoiceNumber) {
      if (shugyoEmail && shugyoEmail.includes("@")) {
        const res = await sendInvoiceReadyEmail({
          to: shugyoEmail,
          userName: shugyoRealName,
          downloadUrl: invoiceUrl,
          isBusiness: shugyoIsGeschaeftskunde ?? false,
          invoiceNumber: tx.invoiceNumber,
          expertName: booking.expertName,
          date: booking.date,
        })
        results.invoice = res
      } else {
        results.invoice = { sent: false, error: "Keine gültige Shugyo-E-Mail-Adresse" }
      }
    }

    if ((type === "credit" || type === "both") && tx.creditNoteNumber && takumiEmail) {
      const res = await sendCreditNoteReadyEmail({
        to: takumiEmail,
        takumiName: booking.expert?.name ?? "",
        downloadUrl: creditUrl,
        isBusiness: takumiIsGeschaeftskunde ?? false,
        creditNoteNumber: tx.creditNoteNumber,
        userName: shugyoRealName,
        date: booking.date,
      })
      results.credit = res
    } else if (type === "credit" || type === "both") {
      results.credit = { sent: false, error: "Keine Takumi-E-Mail-Adresse oder keine Gutschrift" }
    }

    const allOk =
      (type === "invoice" ? results.invoice?.sent : true) &&
      (type === "credit" ? results.credit?.sent : true) &&
      (type === "both"
        ? (results.invoice?.sent ?? true) && (results.credit?.sent ?? !takumiEmail)
        : true)

    return NextResponse.json({
      success: allOk,
      message: allOk ? "E-Mail(s) versendet." : "E-Mail-Versand fehlgeschlagen.",
      results,
    })
  } catch (err) {
    console.error("[admin/finance/resend-invoice] Error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

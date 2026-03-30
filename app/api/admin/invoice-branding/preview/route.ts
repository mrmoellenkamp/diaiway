import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { INVOICE_DOC_KEYS, type InvoiceDocKey } from "@/lib/invoice-doc-templates"
import {
  generateCreditNotePdf,
  generateInvoicePdf,
  generateStornoCreditNotePdf,
  generateStornoInvoicePdf,
  generateWalletTopupInvoicePdf,
  pdfDemoRecipientInvoiceData,
} from "@/lib/pdf-invoice"

export const runtime = "nodejs"

function isDocKey(s: string): s is InvoiceDocKey {
  return (INVOICE_DOC_KEYS as readonly string[]).includes(s)
}

const filenames: Record<InvoiceDocKey, string> = {
  re_session: "diaiway-vorschau-re-session.pdf",
  re_wallet: "diaiway-vorschau-re-wallet.pdf",
  gs: "diaiway-vorschau-gutschrift.pdf",
  sr: "diaiway-vorschau-storno-re.pdf",
  sg: "diaiway-vorschau-storno-gutschrift.pdf",
  re_commission: "diaiway-vorschau-provisionsrechnung.pdf",
}

/**
 * GET /api/admin/invoice-branding/preview?doc=re_session|re_wallet|gs|sr|sg
 * Muster-PDF mit aktuell gespeichertem Branding (nach „Speichern“).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== "admin") {
    return NextResponse.json({ error: "Kein Admin." }, { status: 403 })
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== "admin") {
    return NextResponse.json({ error: "Kein Admin." }, { status: 403 })
  }

  const docParam = req.nextUrl.searchParams.get("doc") ?? "re_session"
  const doc: InvoiceDocKey = isDocKey(docParam) ? docParam : "re_session"
  const demoDate = new Date()

  try {
    let pdfBuf: ArrayBuffer

    switch (doc) {
      case "re_wallet":
        pdfBuf = await generateWalletTopupInvoicePdf({
          invoiceNumber: "RE-WALLET-VORSCHAU",
          recipientName: "Musterfirma GmbH",
          recipientEmail: "rechnung@beispiel.de",
          recipientCustomerNumber: "KD-VORSCHAU",
          recipientCountry: "Germany",
          recipientInvoiceData: pdfDemoRecipientInvoiceData,
          amountCents: 10000,
          date: demoDate,
          introGreeting: { firstName: "Max", lastName: "Mustermann", username: "muster_max" },
        })
        break
      case "gs":
        pdfBuf = await generateCreditNotePdf({
          creditNumber: "GS-VORSCHAU",
          recipientName: "Expertin Muster",
          recipientEmail: "expert@beispiel.de",
          recipientCustomerNumber: "KD-VORSCHAU",
          recipientCountry: "Germany",
          recipientInvoiceData: {
            ...pdfDemoRecipientInvoiceData,
            companyName: "Expertin Muster",
            email: "expert@beispiel.de",
          },
          bookingId: "bkl-vorschau-demo",
          netPayoutCents: 4250,
          platformFeeCents: 750,
          totalAmountCents: 5000,
          date: demoDate,
          useZugferd: false,
        })
        break
      case "sr":
        pdfBuf = await generateStornoInvoicePdf({
          stornoNumber: "SR-VORSCHAU",
          originalInvoiceNumber: "RE-ORIG-VORSCHAU",
          recipientName: "Musterfirma GmbH",
          recipientEmail: "rechnung@beispiel.de",
          recipientCustomerNumber: "KD-VORSCHAU",
          recipientCountry: "Germany",
          recipientInvoiceData: pdfDemoRecipientInvoiceData,
          bookingId: "bkl-vorschau-demo",
          expertName: "Expertin Muster",
          totalAmountCents: 5950,
          date: demoDate,
        })
        break
      case "sg":
        pdfBuf = await generateStornoCreditNotePdf({
          stornoNumber: "SG-VORSCHAU",
          originalCreditNoteNumber: "GS-ORIG-VORSCHAU",
          recipientName: "Expertin Muster",
          recipientEmail: "expert@beispiel.de",
          recipientCustomerNumber: "KD-VORSCHAU",
          recipientCountry: "Germany",
          recipientInvoiceData: {
            ...pdfDemoRecipientInvoiceData,
            companyName: "Expertin Muster",
            email: "expert@beispiel.de",
          },
          bookingId: "bkl-vorschau-demo",
          netPayoutCents: 4250,
          platformFeeCents: 750,
          totalAmountCents: 5000,
          date: demoDate,
        })
        break
      case "re_session":
      default:
        pdfBuf = await generateInvoicePdf({
          invoiceNumber: "RE-VORSCHAU",
          recipientName: "Musterfirma GmbH",
          recipientEmail: "rechnung@beispiel.de",
          recipientCustomerNumber: "KD-VORSCHAU",
          recipientCountry: "Germany",
          recipientInvoiceData: pdfDemoRecipientInvoiceData,
          bookingId: "bkl-vorschau-demo",
          expertName: "Expertin Muster",
          totalAmountCents: 5950,
          date: demoDate,
          durationMinutes: 30,
          useZugferd: false,
          introGreeting: { firstName: "Max", lastName: "Mustermann", username: "muster_max" },
        })
        break
    }

    return new NextResponse(Buffer.from(pdfBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filenames[doc]}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    console.error("[invoice-branding/preview]", e)
    return NextResponse.json({ error: "PDF konnte nicht erzeugt werden." }, { status: 500 })
  }
}

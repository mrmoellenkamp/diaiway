import { jsPDF } from "jspdf"

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €"
}

/**
 * Rechnung A: Von diaiway an den Shugyo über den vollen Bruttobetrag.
 */
export function generateInvoicePdf(opts: {
  invoiceNumber: string
  recipientName: string
  recipientEmail: string
  bookingId: string
  expertName: string
  totalAmountCents: number
  date: Date
}): ArrayBuffer {
  const doc = new jsPDF()
  const { invoiceNumber, recipientName, recipientEmail, bookingId, expertName, totalAmountCents, date } = opts

  doc.setFontSize(18)
  doc.text("Rechnung", 20, 25)
  doc.setFontSize(10)
  doc.text(`Rechnungsnummer: ${invoiceNumber}`, 20, 35)
  doc.text(`Datum: ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text("diAiway", 20, 55)
  doc.setFontSize(9)
  doc.text("Zahlungsabwicklung", 20, 62)

  doc.text("Rechnungsempfänger:", 20, 78)
  doc.text(recipientName, 20, 85)
  doc.text(recipientEmail, 20, 92)

  doc.setFontSize(10)
  doc.text("Positionen:", 20, 110)
  doc.text(`Video-Session mit ${expertName} (Buchung ${bookingId})`, 20, 120)
  doc.text(`Gesamtbetrag: ${formatCents(totalAmountCents)}`, 20, 130)

  doc.text("Zahlbar sofort. Enthält 19% MwSt. (falls anwendbar).", 20, 150)
  doc.setFontSize(8)
  doc.text("Vielen Dank für Ihr Vertrauen. — diAiway", 20, 270)

  return doc.output("arraybuffer") as ArrayBuffer
}

/**
 * Gutschrift B: Von diaiway an den Takumi über seinen Netto-Verdienst.
 */
export function generateCreditNotePdf(opts: {
  creditNumber: string
  recipientName: string
  recipientEmail: string
  bookingId: string
  netPayoutCents: number
  platformFeeCents: number
  totalAmountCents: number
  date: Date
}): ArrayBuffer {
  const doc = new jsPDF()
  const {
    creditNumber,
    recipientName,
    recipientEmail,
    bookingId,
    netPayoutCents,
    platformFeeCents,
    totalAmountCents,
    date,
  } = opts

  doc.setFontSize(18)
  doc.text("Gutschrift", 20, 25)
  doc.setFontSize(10)
  doc.text(`Gutschrift-Nr.: ${creditNumber}`, 20, 35)
  doc.text(`Datum: ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text("diAiway", 20, 55)
  doc.setFontSize(9)
  doc.text("Auszahlungsbetrag", 20, 62)

  doc.text("Empfänger:", 20, 78)
  doc.text(recipientName, 20, 85)
  doc.text(recipientEmail, 20, 92)

  doc.setFontSize(10)
  doc.text("Details:", 20, 110)
  doc.text(`Buchung ${bookingId}`, 20, 120)
  doc.text(`Bruttobetrag: ${formatCents(totalAmountCents)}`, 20, 130)
  doc.text(`Plattformgebühr (15%): -${formatCents(platformFeeCents)}`, 20, 138)
  doc.text(`Netto-Auszahlung: ${formatCents(netPayoutCents)}`, 20, 148)

  doc.setFontSize(8)
  doc.text("Dieser Betrag wurde Ihrem Wallet-Guthaben gutgeschrieben. — diAiway", 20, 270)

  return doc.output("arraybuffer") as ArrayBuffer
}

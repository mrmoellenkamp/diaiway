import { jsPDF } from "jspdf"
import { BILLING_SENDER } from "./billing-config"
import { buildFacturXXml, embedFacturXInPdf } from "./zugferd"

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €"
}

function formatDateYyyyMmDd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/**
 * Rechnung (RE): Von diaiway an den Shugyo über den vollen Bruttobetrag.
 * ZUGFeRD: factur-x.xml nur für Geschäftskunden (invoiceData.type === "unternehmen").
 */
export async function generateInvoicePdf(opts: {
  invoiceNumber: string
  recipientName: string
  recipientEmail: string
  bookingId: string
  expertName: string
  totalAmountCents: number
  date: Date
  /** Dauer in Minuten — für ZUGFeRD Quantity (15-Min-Einheiten) */
  durationMinutes?: number
  /** ZUGFeRD einbetten (nur für Geschäftskunden) */
  useZugferd?: boolean
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const { invoiceNumber, recipientName, recipientEmail, bookingId, expertName, totalAmountCents, date, durationMinutes = 30, useZugferd = false } = opts

  const quantitySlots15 = Math.max(1, Math.round(durationMinutes / 15))
  const serviceLabel = "Expertensitzung"
  const lineDesc = `${serviceLabel} mit ${expertName} (Buchung ${bookingId}), ${quantitySlots15} × 15 Min`

  doc.setFontSize(18)
  doc.text("Rechnung", 20, 25)
  doc.setFontSize(10)
  doc.text(`Rechnungsnummer: ${invoiceNumber}`, 20, 35)
  doc.text(`Datum: ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text(BILLING_SENDER.name, 20, 55)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    62
  )
  if (BILLING_SENDER.vatId) doc.text(`USt-IdNr.: ${BILLING_SENDER.vatId}`, 20, 68)

  doc.text("Rechnungsempfänger:", 20, 78)
  doc.text(recipientName, 20, 85)
  doc.text(recipientEmail, 20, 92)

  doc.setFontSize(10)
  doc.text("Positionen:", 20, 110)
  doc.text(lineDesc, 20, 120)
  doc.text(`Menge: ${quantitySlots15} × 15 Min · Gesamtbetrag: ${formatCents(totalAmountCents)}`, 20, 128)

  doc.text("Zahlbar sofort. Enthält 19% MwSt. (falls anwendbar).", 20, 150)
  doc.setFontSize(8)
  doc.text("Vielen Dank für Ihr Vertrauen. — diAiway", 20, 270)

  let buf = doc.output("arraybuffer") as ArrayBuffer
  if (useZugferd) {
    const unitPriceCents = Math.round(totalAmountCents / quantitySlots15)
    const xml = buildFacturXXml({
      invoiceNumber,
      issueDate: formatDateYyyyMmDd(date),
      sellerName: BILLING_SENDER.name,
      sellerStreet: BILLING_SENDER.address.street,
      sellerZip: BILLING_SENDER.address.zip,
      sellerCity: BILLING_SENDER.address.city,
      sellerCountry: BILLING_SENDER.address.country,
      sellerVatId: BILLING_SENDER.vatId || undefined,
      buyerName: recipientName,
      buyerEmail: recipientEmail,
      lineItemDesc: lineDesc,
      lineQuantity: quantitySlots15,
      lineUnitPriceCents: unitPriceCents,
      lineAmountCents: totalAmountCents,
      totalAmountCents,
      currency: "EUR",
      vatPercent: 19,
    })
    buf = await embedFacturXInPdf(buf, xml)
  }
  return buf
}

/**
 * Gutschrift (GS): Von diaiway an den Takumi über seinen Netto-Verdienst.
 * ZUGFeRD nur für Geschäftskunden (invoiceData.type === "unternehmen").
 */
export async function generateCreditNotePdf(opts: {
  creditNumber: string
  recipientName: string
  recipientEmail: string
  bookingId: string
  netPayoutCents: number
  platformFeeCents: number
  totalAmountCents: number
  date: Date
  /** ZUGFeRD einbetten (nur für Geschäftskunden) */
  useZugferd?: boolean
}): Promise<ArrayBuffer> {
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
    useZugferd = false,
  } = opts

  doc.setFontSize(18)
  doc.text("Gutschrift", 20, 25)
  doc.setFontSize(10)
  doc.text(`Gutschrift-Nr.: ${creditNumber}`, 20, 35)
  doc.text(`Datum: ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text(BILLING_SENDER.name, 20, 55)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    62
  )

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

  let buf = doc.output("arraybuffer") as ArrayBuffer
  if (useZugferd) {
    const xml = buildFacturXXml({
      invoiceNumber: creditNumber,
      issueDate: formatDateYyyyMmDd(date),
      sellerName: BILLING_SENDER.name,
      sellerStreet: BILLING_SENDER.address.street,
      sellerZip: BILLING_SENDER.address.zip,
      sellerCity: BILLING_SENDER.address.city,
      sellerCountry: BILLING_SENDER.address.country,
      sellerVatId: BILLING_SENDER.vatId || undefined,
      buyerName: recipientName,
      buyerEmail: recipientEmail,
      lineItemDesc: `Buchung ${bookingId}`,
      lineQuantity: 1,
      lineUnitPriceCents: netPayoutCents,
      lineAmountCents: netPayoutCents,
      totalAmountCents: netPayoutCents,
      currency: "EUR",
      vatPercent: 19,
    })
    buf = await embedFacturXInPdf(buf, xml)
  }
  return buf
}

/**
 * Rechnung für Wallet-Aufladung (RE): Von diaiway an den Shugyo über den Aufladebetrag.
 */
export async function generateWalletTopupInvoicePdf(opts: {
  invoiceNumber: string
  recipientName: string
  recipientEmail: string
  amountCents: number
  date: Date
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const { invoiceNumber, recipientName, recipientEmail, amountCents, date } = opts

  doc.setFontSize(18)
  doc.text("Rechnung", 20, 25)
  doc.setFontSize(10)
  doc.text(`Rechnungsnummer: ${invoiceNumber}`, 20, 35)
  doc.text(`Datum: ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text(BILLING_SENDER.name, 20, 55)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    62
  )
  if (BILLING_SENDER.vatId) doc.text(`USt-IdNr.: ${BILLING_SENDER.vatId}`, 20, 68)

  doc.text("Rechnungsempfänger:", 20, 78)
  doc.text(recipientName, 20, 85)
  doc.text(recipientEmail, 20, 92)

  doc.setFontSize(10)
  doc.text("Positionen:", 20, 110)
  doc.text("Wallet-Aufladung", 20, 120)
  doc.text(`Gesamtbetrag: ${formatCents(amountCents)}`, 20, 128)

  doc.text("Zahlbar sofort. Enthält 19% MwSt. (falls anwendbar).", 20, 150)
  doc.setFontSize(8)
  doc.text("Vielen Dank für Ihr Vertrauen. — diAiway", 20, 270)

  return doc.output("arraybuffer") as ArrayBuffer
}

/**
 * Storno-Rechnung (SR): Storniert die Rechnung (RE) an den Shugyo.
 */
export function generateStornoInvoicePdf(opts: {
  stornoNumber: string
  originalInvoiceNumber: string
  recipientName: string
  recipientEmail: string
  bookingId: string
  expertName: string
  totalAmountCents: number
  date: Date
}): ArrayBuffer {
  const doc = new jsPDF()
  const { stornoNumber, originalInvoiceNumber, recipientName, recipientEmail, bookingId, expertName, totalAmountCents, date } = opts

  doc.setFontSize(18)
  doc.text("Storno-Rechnung", 20, 25)
  doc.setFontSize(10)
  doc.text(`Storno-Nr.: ${stornoNumber}`, 20, 35)
  doc.text(`Storniert: ${originalInvoiceNumber}`, 20, 42)
  doc.text(`Datum: ${date.toLocaleDateString("de-DE")}`, 20, 49)

  doc.text(BILLING_SENDER.name, 20, 62)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    69
  )
  if (BILLING_SENDER.vatId) doc.text(`USt-IdNr.: ${BILLING_SENDER.vatId}`, 20, 75)

  doc.text("Rechnungsempfänger:", 20, 85)
  doc.text(recipientName, 20, 92)
  doc.text(recipientEmail, 20, 99)

  const serviceLabel = "Expertensitzung"
  doc.setFontSize(10)
  doc.text("Stornierte Position:", 20, 115)
  doc.text(`${serviceLabel} mit ${expertName} (Buchung ${bookingId})`, 20, 125)
  doc.text(`Storno-Betrag: -${formatCents(totalAmountCents)}`, 20, 135)

  doc.setFontSize(8)
  doc.text("Diese Storno-Rechnung hebt die Rechnung o.g. Rechnungsnummer auf. — diAiway", 20, 270)

  return doc.output("arraybuffer") as ArrayBuffer
}

/**
 * Storno-Gutschrift (SG): Storniert die Gutschrift (GS) an den Takumi.
 */
export function generateStornoCreditNotePdf(opts: {
  stornoNumber: string
  originalCreditNoteNumber: string
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
    stornoNumber,
    originalCreditNoteNumber,
    recipientName,
    recipientEmail,
    bookingId,
    netPayoutCents,
    platformFeeCents,
    totalAmountCents,
    date,
  } = opts

  doc.setFontSize(18)
  doc.text("Storno-Gutschrift", 20, 25)
  doc.setFontSize(10)
  doc.text(`Storno-Nr.: ${stornoNumber}`, 20, 35)
  doc.text(`Storniert: ${originalCreditNoteNumber}`, 20, 42)
  doc.text(`Datum: ${date.toLocaleDateString("de-DE")}`, 20, 49)

  doc.text(BILLING_SENDER.name, 20, 62)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    69
  )

  doc.text("Empfänger:", 20, 85)
  doc.text(recipientName, 20, 92)
  doc.text(recipientEmail, 20, 99)

  doc.setFontSize(10)
  doc.text("Stornierte Gutschrift:", 20, 115)
  doc.text(`Buchung ${bookingId}`, 20, 125)
  doc.text(`Bruttobetrag: -${formatCents(totalAmountCents)}`, 20, 133)
  doc.text(`Plattformgebühr (15%): +${formatCents(platformFeeCents)}`, 20, 141)
  doc.text(`Netto-Storno: -${formatCents(netPayoutCents)}`, 20, 151)

  doc.setFontSize(8)
  doc.text("Diese Storno-Gutschrift hebt die Gutschrift o.g. Nummer auf. — diAiway", 20, 270)

  return doc.output("arraybuffer") as ArrayBuffer
}

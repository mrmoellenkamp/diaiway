import { jsPDF } from "jspdf"
import { BILLING_SENDER } from "./billing-config"
import { getInvoiceBrandingCached } from "./invoice-branding"
import { resolveInvoiceDocTemplate } from "./invoice-doc-templates"
import {
  drawClosingAndFooter,
  drawPaymentClosingAndFooter,
  drawPdfHeader,
} from "./pdf-invoice-branding"
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

/** X-Position für Kundennummer im Kopf (neben Beleg-/Storno-Nummer) */
const KD_HEADER_X = 108

function drawCustomerNumberHeader(
  doc: InstanceType<typeof jsPDF>,
  y: number,
  customerLabel: string,
  kd: string | undefined
): void {
  if (!kd) return
  doc.text(`${customerLabel} ${kd}`, KD_HEADER_X, y)
}

/**
 * Rechnung (RE): Von diaiway an den Shugyo über den vollen Bruttobetrag.
 * ZUGFeRD: factur-x.xml nur für Geschäftskunden (invoiceData.type === "unternehmen").
 */
export async function generateInvoicePdf(opts: {
  invoiceNumber: string
  recipientName: string
  recipientEmail: string
  /** Kundennummer (KD-…) des Rechnungsempfängers */
  recipientCustomerNumber?: string | null
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
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("re_session", branding)
  await drawPdfHeader(doc, t.title, branding)

  const {
    invoiceNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    bookingId,
    expertName,
    totalAmountCents,
    date,
    durationMinutes = 30,
    useZugferd = false,
  } = opts

  const quantitySlots15 = Math.max(1, Math.round(durationMinutes / 15))
  const lineDesc = `${t.serviceName} mit ${expertName} (Buchung ${bookingId}), ${quantitySlots15} × 15 Min`
  const kd = recipientCustomerNumber?.trim()

  doc.setFontSize(10)
  doc.text(`${t.documentNumberLabel} ${invoiceNumber}`, 20, 35)
  drawCustomerNumberHeader(doc, 35, t.customerNumberLabel, kd)
  doc.text(`${t.dateLabel} ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text(BILLING_SENDER.name, 20, 55)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    62
  )
  if (BILLING_SENDER.vatId) doc.text(`USt-IdNr.: ${BILLING_SENDER.vatId}`, 20, 68)

  doc.setFontSize(10)
  doc.text(t.recipientLabel, 20, 78)
  doc.text(recipientName, 20, 85)
  doc.text(recipientEmail, 20, 92)
  const yAfterRecipient = 99
  const positionsY = yAfterRecipient + 11
  doc.text(t.sectionLabel, 20, positionsY)
  doc.text(lineDesc, 20, positionsY + 10)
  doc.text(
    `Menge: ${quantitySlots15} × 15 Min · Gesamtbetrag: ${formatCents(totalAmountCents)}`,
    20,
    positionsY + 18
  )

  drawPaymentClosingAndFooter(
    doc,
    { paymentNote: t.paymentNote, closingLine: t.closingLine, footerText: t.footerText },
    150
  )

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
      buyerReference: kd || undefined,
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
  recipientCustomerNumber?: string | null
  bookingId: string
  netPayoutCents: number
  platformFeeCents: number
  totalAmountCents: number
  date: Date
  /** ZUGFeRD einbetten (nur für Geschäftskunden) */
  useZugferd?: boolean
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("gs", branding)
  await drawPdfHeader(doc, t.title, branding)

  const {
    creditNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    bookingId,
    netPayoutCents,
    platformFeeCents,
    totalAmountCents,
    date,
    useZugferd = false,
  } = opts

  const kdCredit = recipientCustomerNumber?.trim()

  doc.setFontSize(10)
  doc.text(`${t.documentNumberLabel} ${creditNumber}`, 20, 35)
  drawCustomerNumberHeader(doc, 35, t.customerNumberLabel, kdCredit)
  doc.text(`${t.dateLabel} ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text(BILLING_SENDER.name, 20, 55)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    62
  )

  doc.setFontSize(10)
  doc.text(t.recipientLabel, 20, 78)
  doc.text(recipientName, 20, 85)
  doc.text(recipientEmail, 20, 92)
  const yAfterEmpf = 99
  const detailsY = yAfterEmpf + 11
  doc.setFontSize(10)
  doc.text(t.sectionLabel, 20, detailsY)
  doc.text(`Buchung ${bookingId}`, 20, detailsY + 10)
  doc.text(`${t.detailBruttoPrefix} ${formatCents(totalAmountCents)}`, 20, detailsY + 20)
  doc.text(`${t.detailFeePrefix} -${formatCents(platformFeeCents)}`, 20, detailsY + 28)
  doc.text(`${t.detailNetPrefix} ${formatCents(netPayoutCents)}`, 20, detailsY + 36)

  drawClosingAndFooter(doc, { closingLine: t.closingLine, footerText: t.footerText })

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
      buyerReference: kdCredit || undefined,
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
  recipientCustomerNumber?: string | null
  amountCents: number
  date: Date
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("re_wallet", branding)
  await drawPdfHeader(doc, t.title, branding)

  const { invoiceNumber, recipientName, recipientEmail, recipientCustomerNumber, amountCents, date } = opts
  const kdWallet = recipientCustomerNumber?.trim()

  doc.setFontSize(10)
  doc.text(`${t.documentNumberLabel} ${invoiceNumber}`, 20, 35)
  drawCustomerNumberHeader(doc, 35, t.customerNumberLabel, kdWallet)
  doc.text(`${t.dateLabel} ${date.toLocaleDateString("de-DE")}`, 20, 42)

  doc.text(BILLING_SENDER.name, 20, 55)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    62
  )
  if (BILLING_SENDER.vatId) doc.text(`USt-IdNr.: ${BILLING_SENDER.vatId}`, 20, 68)

  doc.setFontSize(10)
  doc.text(t.recipientLabel, 20, 78)
  doc.text(recipientName, 20, 85)
  doc.text(recipientEmail, 20, 92)
  const yWallet = 99
  const posWalletY = yWallet + 11
  doc.setFontSize(10)
  doc.text(t.sectionLabel, 20, posWalletY)
  doc.text(t.walletLineText, 20, posWalletY + 10)
  doc.text(`Gesamtbetrag: ${formatCents(amountCents)}`, 20, posWalletY + 18)

  drawPaymentClosingAndFooter(
    doc,
    { paymentNote: t.paymentNote, closingLine: t.closingLine, footerText: t.footerText },
    150
  )

  return doc.output("arraybuffer") as ArrayBuffer
}

/**
 * Storno-Rechnung (SR): Storniert die Rechnung (RE) an den Shugyo.
 */
export async function generateStornoInvoicePdf(opts: {
  stornoNumber: string
  originalInvoiceNumber: string
  recipientName: string
  recipientEmail: string
  recipientCustomerNumber?: string | null
  bookingId: string
  expertName: string
  totalAmountCents: number
  date: Date
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("sr", branding)
  await drawPdfHeader(doc, t.title, branding)

  const {
    stornoNumber,
    originalInvoiceNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    bookingId,
    expertName,
    totalAmountCents,
    date,
  } = opts

  const kdSt = recipientCustomerNumber?.trim()

  doc.setFontSize(10)
  doc.text(`${t.stornoNumberLabel} ${stornoNumber}`, 20, 35)
  drawCustomerNumberHeader(doc, 35, t.customerNumberLabel, kdSt)
  doc.text(`${t.storniertLabel} ${originalInvoiceNumber}`, 20, 42)
  doc.text(`${t.dateLabel} ${date.toLocaleDateString("de-DE")}`, 20, 49)

  doc.text(BILLING_SENDER.name, 20, 62)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    69
  )
  if (BILLING_SENDER.vatId) doc.text(`USt-IdNr.: ${BILLING_SENDER.vatId}`, 20, 75)

  doc.setFontSize(10)
  doc.text(t.recipientLabel, 20, 85)
  doc.text(recipientName, 20, 92)
  doc.text(recipientEmail, 20, 99)
  const ySt = 106
  const stPosY = ySt + 9
  doc.setFontSize(10)
  doc.text(t.sectionLabel, 20, stPosY)
  doc.text(`${t.serviceName} mit ${expertName} (Buchung ${bookingId})`, 20, stPosY + 10)
  doc.text(`${t.stornoBetragPrefix} -${formatCents(totalAmountCents)}`, 20, stPosY + 20)

  drawClosingAndFooter(doc, { closingLine: t.closingLine, footerText: t.footerText })

  return doc.output("arraybuffer") as ArrayBuffer
}

/**
 * Storno-Gutschrift (SG): Storniert die Gutschrift (GS) an den Takumi.
 */
export async function generateStornoCreditNotePdf(opts: {
  stornoNumber: string
  originalCreditNoteNumber: string
  recipientName: string
  recipientEmail: string
  /** Kundennummer des Gutschrift-Empfängers (Takumi) */
  recipientCustomerNumber?: string | null
  bookingId: string
  netPayoutCents: number
  platformFeeCents: number
  totalAmountCents: number
  date: Date
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("sg", branding)
  await drawPdfHeader(doc, t.title, branding)

  const {
    stornoNumber,
    originalCreditNoteNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    bookingId,
    netPayoutCents,
    platformFeeCents,
    totalAmountCents,
    date,
  } = opts

  const kdSg = recipientCustomerNumber?.trim()

  doc.setFontSize(10)
  doc.text(`${t.stornoNumberLabel} ${stornoNumber}`, 20, 35)
  drawCustomerNumberHeader(doc, 35, t.customerNumberLabel, kdSg)
  doc.text(`${t.storniertLabel} ${originalCreditNoteNumber}`, 20, 42)
  doc.text(`${t.dateLabel} ${date.toLocaleDateString("de-DE")}`, 20, 49)

  doc.text(BILLING_SENDER.name, 20, 62)
  doc.setFontSize(9)
  doc.text(
    `${BILLING_SENDER.address.street}, ${BILLING_SENDER.address.zip} ${BILLING_SENDER.address.city}`,
    20,
    69
  )

  doc.setFontSize(10)
  doc.text(t.recipientLabel, 20, 85)
  doc.text(recipientName, 20, 92)
  doc.text(recipientEmail, 20, 99)

  doc.text(t.sectionLabel, 20, 115)
  doc.text(`Buchung ${bookingId}`, 20, 125)
  doc.text(`${t.detailBruttoPrefix} -${formatCents(totalAmountCents)}`, 20, 133)
  doc.text(`${t.detailFeePrefix} +${formatCents(platformFeeCents)}`, 20, 141)
  doc.text(`${t.detailNetPrefix} -${formatCents(netPayoutCents)}`, 20, 151)

  drawClosingAndFooter(doc, { closingLine: t.closingLine, footerText: t.footerText })

  return doc.output("arraybuffer") as ArrayBuffer
}

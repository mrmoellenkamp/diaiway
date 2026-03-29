import { jsPDF } from "jspdf"
import { BILLING_SENDER } from "./billing-config"
import { getInvoiceBrandingCached } from "./invoice-branding"
import {
  invoiceDataAddressLines,
  invoiceDataCountry,
  type InvoiceIntroGreeting,
} from "./invoice-requirements"
import { resolveInvoiceDocTemplate } from "./invoice-doc-templates"
import {
  INV_DE_COLORS,
  INV_DE_LAYOUT,
  drawHtmlTemplateDetailRowsBlock,
  drawHtmlTemplateInvoiceHeader,
  drawHtmlTemplateInvoiceTableAndTotals,
  drawMwStTripleColumnPageFooter,
  drawPaymentClosingAndFooter,
  grossToNetAndVatCents,
} from "./pdf-invoice-branding"
import { buildFacturXXml, embedFacturXInPdf } from "./zugferd"

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €"
}

/** Text vor dem Takumi-Namen in RE/SR; altes Default „Expertensitzung“ → „Video/Voicecall mit Takumi“. */
function sessionServiceLeadPhrase(serviceName: string): string {
  const s = serviceName.trim()
  if (!s || s === "Expertensitzung") return "Video/Voicecall mit Takumi"
  return s
}

function formatDateYyyyMmDd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/** Anzeige auf Belegen: dd.mm.yyyy (führende Nullen) */
function formatInvoiceDateDdMmYyyy(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}.${month}.${year}`
}

function pdfLineHeightMm(fontPt: number): number {
  return (fontPt * 1.4 * 25.4) / 72
}

function fillInvoiceIntroductionPlaceholders(intro: string, greeting: InvoiceIntroGreeting | undefined): string {
  if (!intro.includes("{{")) return intro
  const g = greeting ?? { firstName: "", lastName: "", username: "—" }
  let s = intro
    .replace(/\{\{firstName\}\}/g, g.firstName)
    .replace(/\{\{lastName\}\}/g, g.lastName)
    .replace(/\{\{username\}\}/g, g.username)
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
  s = s.replace(/Guten Tag\s+\(/g, "Guten Tag (")
  return s
}

/** Absätze durch Leerzeile getrennt; innerhalb eines Absatzes erzeugt ein einzelnes \n eine neue Zeile. */
function drawIntroductionBlocks(
  doc: jsPDF,
  x0: number,
  y: number,
  textW: number,
  intro: string,
  bodyPt: number
): number {
  const lh = pdfLineHeightMm(bodyPt)
  const paraGap = lh * 0.35
  const [tx, ty, tz] = INV_DE_COLORS.text
  doc.setFont("helvetica", "normal")
  doc.setFontSize(bodyPt)
  doc.setTextColor(tx, ty, tz)
  const blocks = intro.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  if (blocks.length === 0) return y
  let yy = y
  for (let i = 0; i < blocks.length; i++) {
    const physicalLines = blocks[i].split(/\n/)
    for (let li = 0; li < physicalLines.length; li++) {
      const wrapped = doc.splitTextToSize(physicalLines[li].trimEnd(), textW)
      doc.text(wrapped, x0, yy)
      yy += wrapped.length * lh
    }
    if (i < blocks.length - 1) yy += paraGap
  }
  return yy + INV_DE_LAYOUT.introMarginBottom
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
  /** Land des Kunden (Rechnungsdaten); sonst „—“ */
  recipientCountry?: string | null
  bookingId: string
  expertName: string
  totalAmountCents: number
  date: Date
  /** Dauer in Minuten — für ZUGFeRD Quantity (15-Min-Einheiten) */
  durationMinutes?: number
  /** ZUGFeRD einbetten (nur für Geschäftskunden) */
  useZugferd?: boolean
  /** Platzhalter {{firstName}}, {{lastName}}, {{username}} in introductionText */
  introGreeting?: InvoiceIntroGreeting | null
  /** Rechnungsdaten des Empfängers (Straße/PLZ im Kopf) */
  recipientInvoiceData?: unknown | null
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("re_session", branding)

  const {
    invoiceNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    recipientCountry,
    bookingId,
    expertName,
    totalAmountCents,
    date,
    durationMinutes = 30,
    useZugferd = false,
    introGreeting = undefined,
    recipientInvoiceData = null,
  } = opts

  const { streetLine: recipientStreetLine, cityLine: recipientCityLine } =
    invoiceDataAddressLines(recipientInvoiceData)

  const quantitySlots15 = Math.max(1, Math.round(durationMinutes / 15))
  const lineDesc = `${sessionServiceLeadPhrase(t.serviceName)} ${expertName} (Buchung ${bookingId}), ${quantitySlots15} × 15 Min`
  const kd = recipientCustomerNumber?.trim() ?? null
  const dateStr = formatInvoiceDateDdMmYyyy(date)

  const land = recipientCountry?.trim() || "—"
  let y = await drawHtmlTemplateInvoiceHeader(doc, branding, {
    recipientName,
    recipientEmail,
    recipientStreetLine,
    recipientCityLine,
    recipientCountry: land,
    customerNumber: kd,
    invoiceNumber,
    dateStr,
    customerNumberLabel: t.customerNumberLabel,
    dateLabel: t.dateLabel,
    documentNumberLabel: t.documentNumberLabel,
  })

  const x0 = INV_DE_LAYOUT.marginH
  const textW = INV_DE_LAYOUT.contentWidthMm
  const [tx, ty, tz] = INV_DE_COLORS.text
  doc.setFont("helvetica", "bold")
  doc.setFontSize(INV_DE_LAYOUT.subjectPt)
  doc.setTextColor(tx, ty, tz)
  doc.text(`Betreff: ${t.subjectLine.trim() || t.title}`, x0, y)
  y += pdfLineHeightMm(INV_DE_LAYOUT.subjectPt) + INV_DE_LAYOUT.subjectMarginBottom

  const introFilled = fillInvoiceIntroductionPlaceholders(t.introductionText.trim(), introGreeting ?? undefined)
  if (introFilled.trim()) {
    y = drawIntroductionBlocks(doc, x0, y, textW, introFilled, INV_DE_LAYOUT.bodyPt)
  }

  const { netCents, vatCents } = grossToNetAndVatCents(totalAmountCents, 19)
  y = drawHtmlTemplateInvoiceTableAndTotals(doc, y, {
    sectionTitle: null,
    lineDescription: lineDesc,
    netCents,
    vatCents,
    grossCents: totalAmountCents,
    vatPercent: 19,
  })

  drawPaymentClosingAndFooter(
    doc,
    {
      paymentNote: t.paymentNote,
      closingLine: t.closingLine,
      footerText: t.footerText,
      signatureNote: t.signatureNote,
    },
    y
  )
  drawMwStTripleColumnPageFooter(doc)

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
  /** Land / Anschrift aus Rechnungsdaten */
  recipientCountry?: string | null
  recipientInvoiceData?: unknown | null
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

  const {
    creditNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    recipientCountry,
    recipientInvoiceData = null,
    bookingId,
    netPayoutCents,
    platformFeeCents,
    totalAmountCents,
    date,
    useZugferd = false,
  } = opts

  const kdCredit = recipientCustomerNumber?.trim() ?? null
  const dateStrGs = formatInvoiceDateDdMmYyyy(date)
  const { streetLine: recipientStreetLine, cityLine: recipientCityLine } =
    invoiceDataAddressLines(recipientInvoiceData)
  const landGs = recipientCountry?.trim() || invoiceDataCountry(recipientInvoiceData) || "—"

  let yGs = await drawHtmlTemplateInvoiceHeader(doc, branding, {
    recipientName,
    recipientEmail,
    recipientStreetLine,
    recipientCityLine,
    recipientCountry: landGs,
    customerNumber: kdCredit,
    invoiceNumber: creditNumber,
    dateStr: dateStrGs,
    customerNumberLabel: t.customerNumberLabel,
    dateLabel: t.dateLabel,
    documentNumberLabel: t.documentNumberLabel,
  })

  const x0Gs = INV_DE_LAYOUT.marginH
  const textWGs = INV_DE_LAYOUT.contentWidthMm
  const [gx, gy, gz] = INV_DE_COLORS.text
  doc.setFont("helvetica", "bold")
  doc.setFontSize(INV_DE_LAYOUT.subjectPt)
  doc.setTextColor(gx, gy, gz)
  doc.text(`Betreff: ${t.subjectLine.trim() || t.title}`, x0Gs, yGs)
  yGs += pdfLineHeightMm(INV_DE_LAYOUT.subjectPt) + INV_DE_LAYOUT.subjectMarginBottom

  const introGs = fillInvoiceIntroductionPlaceholders(t.introductionText.trim(), undefined)
  if (introGs.trim()) {
    yGs = drawIntroductionBlocks(doc, x0Gs, yGs, textWGs, introGs, INV_DE_LAYOUT.bodyPt)
  }

  yGs = drawHtmlTemplateDetailRowsBlock(doc, yGs, t.sectionLabel, [
    { left: `Buchung ${bookingId}`, right: "" },
    { left: t.detailBruttoPrefix.trim(), right: formatCents(totalAmountCents) },
    { left: t.detailFeePrefix.trim(), right: `-${formatCents(platformFeeCents)}` },
    { left: t.detailNetPrefix.trim(), right: formatCents(netPayoutCents) },
  ])

  drawPaymentClosingAndFooter(
    doc,
    {
      paymentNote: t.paymentNote?.trim() ?? "",
      closingLine: t.closingLine,
      footerText: t.footerText,
      signatureNote: t.signatureNote,
    },
    yGs
  )
  drawMwStTripleColumnPageFooter(doc)

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
  /** Land des Kunden (Rechnungsdaten); sonst „—“ */
  recipientCountry?: string | null
  amountCents: number
  date: Date
  introGreeting?: InvoiceIntroGreeting | null
  recipientInvoiceData?: unknown | null
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("re_wallet", branding)

  const {
    invoiceNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    recipientCountry,
    amountCents,
    date,
    introGreeting = undefined,
    recipientInvoiceData = null,
  } = opts
  const { streetLine: recipientStreetLineW, cityLine: recipientCityLineW } =
    invoiceDataAddressLines(recipientInvoiceData)
  const kdWallet = recipientCustomerNumber?.trim() ?? null
  const landW = recipientCountry?.trim() || "—"
  const dateStrW = formatInvoiceDateDdMmYyyy(date)
  const walletLine = t.walletLineText.trim() || "Wallet-Aufladung"

  let yW = await drawHtmlTemplateInvoiceHeader(doc, branding, {
    recipientName,
    recipientEmail,
    recipientStreetLine: recipientStreetLineW,
    recipientCityLine: recipientCityLineW,
    recipientCountry: landW,
    customerNumber: kdWallet,
    invoiceNumber,
    dateStr: dateStrW,
    customerNumberLabel: t.customerNumberLabel,
    dateLabel: t.dateLabel,
    documentNumberLabel: t.documentNumberLabel,
  })

  const x0W = INV_DE_LAYOUT.marginH
  const textWW = INV_DE_LAYOUT.contentWidthMm
  const [wx, wy, wz] = INV_DE_COLORS.text
  doc.setFont("helvetica", "bold")
  doc.setFontSize(INV_DE_LAYOUT.subjectPt)
  doc.setTextColor(wx, wy, wz)
  doc.text(`Betreff: ${t.subjectLine.trim() || t.title}`, x0W, yW)
  yW += pdfLineHeightMm(INV_DE_LAYOUT.subjectPt) + INV_DE_LAYOUT.subjectMarginBottom

  const introWallet = fillInvoiceIntroductionPlaceholders(t.introductionText.trim(), introGreeting ?? undefined)
  if (introWallet.trim()) {
    yW = drawIntroductionBlocks(doc, x0W, yW, textWW, introWallet, INV_DE_LAYOUT.bodyPt)
  }

  const { netCents: netW, vatCents: vatW } = grossToNetAndVatCents(amountCents, 19)
  yW = drawHtmlTemplateInvoiceTableAndTotals(doc, yW, {
    sectionTitle: null,
    lineDescription: walletLine,
    netCents: netW,
    vatCents: vatW,
    grossCents: amountCents,
    vatPercent: 19,
  })

  drawPaymentClosingAndFooter(
    doc,
    {
      paymentNote: t.paymentNote,
      closingLine: t.closingLine,
      footerText: t.footerText,
      signatureNote: t.signatureNote,
    },
    yW
  )
  drawMwStTripleColumnPageFooter(doc)

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
  recipientCountry?: string | null
  recipientInvoiceData?: unknown | null
  bookingId: string
  expertName: string
  totalAmountCents: number
  date: Date
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("sr", branding)

  const {
    stornoNumber,
    originalInvoiceNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    recipientCountry,
    recipientInvoiceData = null,
    bookingId,
    expertName,
    totalAmountCents,
    date,
  } = opts

  const kdSt = recipientCustomerNumber?.trim() ?? null
  const dateStrSr = formatInvoiceDateDdMmYyyy(date)
  const { streetLine: stStreet, cityLine: stCity } = invoiceDataAddressLines(recipientInvoiceData)
  const landSr = recipientCountry?.trim() || invoiceDataCountry(recipientInvoiceData) || "—"

  let ySr = await drawHtmlTemplateInvoiceHeader(doc, branding, {
    recipientName,
    recipientEmail,
    recipientStreetLine: stStreet,
    recipientCityLine: stCity,
    recipientCountry: landSr,
    customerNumber: kdSt,
    invoiceNumber: stornoNumber,
    dateStr: dateStrSr,
    customerNumberLabel: t.customerNumberLabel,
    dateLabel: t.dateLabel,
    documentNumberLabel: t.stornoNumberLabel,
    secondDocumentLabel: t.storniertLabel,
    secondDocumentValue: originalInvoiceNumber,
  })

  const x0Sr = INV_DE_LAYOUT.marginH
  const textWSr = INV_DE_LAYOUT.contentWidthMm
  const [sx, sy, sz] = INV_DE_COLORS.text
  doc.setFont("helvetica", "bold")
  doc.setFontSize(INV_DE_LAYOUT.subjectPt)
  doc.setTextColor(sx, sy, sz)
  doc.text(`Betreff: ${t.subjectLine.trim() || t.title}`, x0Sr, ySr)
  ySr += pdfLineHeightMm(INV_DE_LAYOUT.subjectPt) + INV_DE_LAYOUT.subjectMarginBottom

  const introSr = fillInvoiceIntroductionPlaceholders(t.introductionText.trim(), undefined)
  if (introSr.trim()) {
    ySr = drawIntroductionBlocks(doc, x0Sr, ySr, textWSr, introSr, INV_DE_LAYOUT.bodyPt)
  }

  ySr = drawHtmlTemplateDetailRowsBlock(doc, ySr, t.sectionLabel, [
    { left: `${sessionServiceLeadPhrase(t.serviceName)} ${expertName} (Buchung ${bookingId})`, right: "" },
    { left: t.stornoBetragPrefix.trim(), right: `-${formatCents(totalAmountCents)}` },
  ])

  drawPaymentClosingAndFooter(
    doc,
    {
      paymentNote: t.paymentNote?.trim() ?? "",
      closingLine: t.closingLine,
      footerText: t.footerText,
      signatureNote: t.signatureNote,
    },
    ySr
  )
  drawMwStTripleColumnPageFooter(doc)

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
  recipientCountry?: string | null
  recipientInvoiceData?: unknown | null
  bookingId: string
  netPayoutCents: number
  platformFeeCents: number
  totalAmountCents: number
  date: Date
}): Promise<ArrayBuffer> {
  const doc = new jsPDF()
  const branding = await getInvoiceBrandingCached()
  const t = resolveInvoiceDocTemplate("sg", branding)

  const {
    stornoNumber,
    originalCreditNoteNumber,
    recipientName,
    recipientEmail,
    recipientCustomerNumber,
    recipientCountry,
    recipientInvoiceData = null,
    bookingId,
    netPayoutCents,
    platformFeeCents,
    totalAmountCents,
    date,
  } = opts

  const kdSg = recipientCustomerNumber?.trim() ?? null
  const dateStrSg = formatInvoiceDateDdMmYyyy(date)
  const { streetLine: sgStreet, cityLine: sgCity } = invoiceDataAddressLines(recipientInvoiceData)
  const landSg = recipientCountry?.trim() || invoiceDataCountry(recipientInvoiceData) || "—"

  let ySg = await drawHtmlTemplateInvoiceHeader(doc, branding, {
    recipientName,
    recipientEmail,
    recipientStreetLine: sgStreet,
    recipientCityLine: sgCity,
    recipientCountry: landSg,
    customerNumber: kdSg,
    invoiceNumber: stornoNumber,
    dateStr: dateStrSg,
    customerNumberLabel: t.customerNumberLabel,
    dateLabel: t.dateLabel,
    documentNumberLabel: t.stornoNumberLabel,
    secondDocumentLabel: t.storniertLabel,
    secondDocumentValue: originalCreditNoteNumber,
  })

  const x0Sg = INV_DE_LAYOUT.marginH
  const textWSg = INV_DE_LAYOUT.contentWidthMm
  const [qx, qy, qz] = INV_DE_COLORS.text
  doc.setFont("helvetica", "bold")
  doc.setFontSize(INV_DE_LAYOUT.subjectPt)
  doc.setTextColor(qx, qy, qz)
  doc.text(`Betreff: ${t.subjectLine.trim() || t.title}`, x0Sg, ySg)
  ySg += pdfLineHeightMm(INV_DE_LAYOUT.subjectPt) + INV_DE_LAYOUT.subjectMarginBottom

  const introSg = fillInvoiceIntroductionPlaceholders(t.introductionText.trim(), undefined)
  if (introSg.trim()) {
    ySg = drawIntroductionBlocks(doc, x0Sg, ySg, textWSg, introSg, INV_DE_LAYOUT.bodyPt)
  }

  ySg = drawHtmlTemplateDetailRowsBlock(doc, ySg, t.sectionLabel, [
    { left: `Buchung ${bookingId}`, right: "" },
    { left: t.detailBruttoPrefix.trim(), right: `-${formatCents(totalAmountCents)}` },
    { left: t.detailFeePrefix.trim(), right: `+${formatCents(platformFeeCents)}` },
    { left: t.detailNetPrefix.trim(), right: `-${formatCents(netPayoutCents)}` },
  ])

  drawPaymentClosingAndFooter(
    doc,
    {
      paymentNote: t.paymentNote?.trim() ?? "",
      closingLine: t.closingLine,
      footerText: t.footerText,
      signatureNote: t.signatureNote,
    },
    ySg
  )
  drawMwStTripleColumnPageFooter(doc)

  return doc.output("arraybuffer") as ArrayBuffer
}

/** Demo-`invoiceData` für PDF-Vorschau und Test-Routen (Adresszeilen im Kopf). */
export const pdfDemoRecipientInvoiceData = {
  type: "unternehmen" as const,
  companyName: "Musterfirma GmbH",
  street: "Musterstraße",
  houseNumber: "42",
  zip: "10115",
  city: "Berlin",
  country: "Germany",
  email: "rechnung@beispiel.de",
}

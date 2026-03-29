import "server-only"

import fs from "node:fs/promises"
import path from "node:path"

import type jsPDF from "jspdf"
import sharp from "sharp"

import { BILLING_SENDER } from "./billing-config"
import type { InvoiceBrandingDTO } from "./invoice-branding"
import type { ResolvedInvoiceDocTemplate } from "./invoice-doc-templates"

/** Standard-Logo für PDFs (transparent, scharf skalierbar); liegt unter `public/`. */
const DEFAULT_PDF_LOGO_FILENAME = "diaiway-logo-transparent.svg"

/** CSS px @ 96dpi → mm — orientiert an der HTML-Rechnungsvorlage (z. B. padding 40px) */
export function cssPxToMm(px: number): number {
  return (px * 25.4) / 96
}

function cssPxToPt(px: number): number {
  return (px * 72) / 96
}

/**
 * DIN 5008 Form B (Geschäftsbrief / Fensterbrief) — Maße in mm für PDF.
 * Anschriftfeld links, Kommunikationsangaben rechts; Abstände üblich für Fensterkuverts.
 */
export const DIN_5008_MM = {
  textLeft: 25,
  textRight: 20,
  textBottom: 20,
  /** Kleingedruckte Absenderzeile (Basislinie), oberhalb der Empfängeranschrift */
  returnAddressBaseline: 34,
  /** Erste Zeile Empfängeranschrift (Basislinie) — typisch Fensterlage */
  recipientFirstBaseline: 50,
  /** Max. Breite Anschriftfeld */
  addressFieldWidth: 85,
  /** Zeilenabstand Anschrift (1/6-Zoll-Raster ≈ 4,233 mm) */
  addressLineStep: 4.233,
  /** Leerraum nach Anschriftblock vor Betreff (eine Leerzeile) */
  gapAfterAddressMm: 10,
  /** Schrift Absender klein (pt) */
  returnAddressPt: 7,
} as const

/** A4-Nutzrand, an DIN 5008 angelehnt (oben variabel je Zone im Kopf) */
export const PAGE_A4_MARGIN_MM = {
  top: 25,
  bottom: DIN_5008_MM.textBottom,
  left: DIN_5008_MM.textLeft,
  right: DIN_5008_MM.textRight,
} as const

/** Layout-Konstanten inkl. Seitenränder und Typografie */
export const INV_DE_LAYOUT = {
  marginTop: PAGE_A4_MARGIN_MM.top,
  marginBottom: PAGE_A4_MARGIN_MM.bottom,
  marginLeft: PAGE_A4_MARGIN_MM.left,
  marginRight: PAGE_A4_MARGIN_MM.right,
  /** Synonym: links = rechts (historisch marginH) */
  marginH: PAGE_A4_MARGIN_MM.left,
  marginFooterB: PAGE_A4_MARGIN_MM.bottom,
  contentWidthMm: 210 - PAGE_A4_MARGIN_MM.left - PAGE_A4_MARGIN_MM.right,
  contentRightMm: 210 - PAGE_A4_MARGIN_MM.right,
  /** Spalte Beleg-/Kundendaten rechts neben Anschriftfeld (25 + 85 + Abstand) */
  recipientSecondColX: PAGE_A4_MARGIN_MM.left + 90,
  /** Nach Kopf (nur falls ältere Aufrufer); Rechnung DIN nutzt gapAfterAddressMm */
  gapAfterHeader: cssPxToMm(50),
  recipientMarginTop: cssPxToMm(10),
  senderMarginBottom: cssPxToMm(5),
  subjectMarginBottom: cssPxToMm(20),
  introMarginBottom: cssPxToMm(20),
  tableMarginV: cssPxToMm(20),
  totalsMarginTop: cssPxToMm(20),
  totalsRowPad: cssPxToMm(4),
  signatureMarginTop: cssPxToMm(40),
  disclaimerMarginTop: cssPxToMm(10),
  footerPadTop: cssPxToMm(10),
  footerColGap: cssPxToMm(20),
  bodyPt: cssPxToPt(12),
  senderPt: cssPxToPt(10),
  subjectPt: cssPxToPt(14),
  footerPt: cssPxToPt(9),
  disclaimerPt: cssPxToPt(10),
  tableCellPadMm: cssPxToMm(8),
} as const

export const INV_DE_COLORS = {
  text: [51, 51, 51] as [number, number, number],
  footer: [102, 102, 102] as [number, number, number],
  disclaimer: [136, 136, 136] as [number, number, number],
  borderSender: [204, 204, 204] as [number, number, number],
  borderRow: [238, 238, 238] as [number, number, number],
} as const

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "")
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return { r: 6, g: 78, b: 59 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export async function drawPdfHeader(
  doc: jsPDF,
  title: string,
  branding: Pick<InvoiceBrandingDTO, "accentHex" | "logoUrl">,
  opts?: { titleYMm?: number; titleFontPt?: number; titleLineEndMm?: number }
): Promise<void> {
  const ml = INV_DE_LAYOUT.marginLeft
  const cr = INV_DE_LAYOUT.contentRightMm
  const titleY = opts?.titleYMm ?? INV_DE_LAYOUT.marginTop + 2
  const lineY = titleY + 3.5
  const fontPt = opts?.titleFontPt ?? 18
  const lineEnd = opts?.titleLineEndMm ?? ml + 75
  const { r, g, b } = hexToRgb(branding.accentHex)
  doc.setTextColor(r, g, b)
  doc.setFontSize(fontPt)
  doc.setFont("helvetica", "bold")
  doc.text(title, ml, titleY)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.35)
  doc.line(ml, lineY, lineEnd, lineY)
  doc.setDrawColor(0, 0, 0)
  await drawLogo(doc, branding.logoUrl, cr - 58, INV_DE_LAYOUT.marginTop, 58)
}

/**
 * Logo ins PDF: zuerst `logoUrl` (Admin/Blob), sonst lokales transparentes SVG.
 * Ausgabe als PNG (Alpha), damit Transparenz auf weißem PDF erhalten bleibt — kein JPEG.
 */
async function drawLogo(
  doc: jsPDF,
  logoUrl: string | null | undefined,
  x: number,
  y: number,
  maxWmm: number
): Promise<void> {
  let buf: Buffer | null = null
  const trimmed = logoUrl?.trim()
  if (trimmed) {
    try {
      const res = await fetch(trimmed)
      if (res.ok) buf = Buffer.from(await res.arrayBuffer())
    } catch {
      // Blob/URL nicht erreichbar → Fallback
    }
  }
  if (!buf) {
    try {
      buf = await fs.readFile(path.join(process.cwd(), "public", DEFAULT_PDF_LOGO_FILENAME))
    } catch {
      return
    }
  }
  try {
    const meta = await sharp(buf).metadata()
    const iw = meta.width || 1
    const ih = meta.height || 1
    const wmm = maxWmm
    const hmm = (wmm * ih) / iw
    const png = await sharp(buf)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer()
    doc.addImage(png.toString("base64"), "PNG", x, y, wmm, hmm)
  } catch {
    // Logo fehlt oder ungültig — PDF ohne Logo
  }
}

/** Brutto → Netto + MwSt (19 %) in Cent, konsistent zur Gesamtsumme */
export function grossToNetAndVatCents(grossCents: number, vatPercent: number): { netCents: number; vatCents: number } {
  const factor = 1 + vatPercent / 100
  const netCents = Math.round(grossCents / factor)
  const vatCents = grossCents - netCents
  return { netCents, vatCents }
}

export function formatEuroDe(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €"
}

function textRight(doc: jsPDF, text: string, rightXMm: number, yMm: number): void {
  const w = doc.getTextWidth(text)
  doc.text(text, rightXMm - w, yMm)
}

/** Wie HTML &lt;strong&gt;Label:&lt;/strong&gt; Wert — rechtsbündig */
function textRightBoldLabelValue(
  doc: jsPDF,
  labelWithColon: string,
  value: string,
  rightXMm: number,
  yMm: number,
  fontPt: number
): void {
  doc.setFontSize(fontPt)
  const lab = labelWithColon.trim()
  const spacer = " "
  doc.setFont("helvetica", "bold")
  const wLab = doc.getTextWidth(lab + spacer)
  doc.setFont("helvetica", "normal")
  const wVal = doc.getTextWidth(value)
  const total = wLab + wVal
  let x = rightXMm - total
  doc.setFont("helvetica", "bold")
  doc.text(lab + spacer, x, yMm)
  x += wLab
  doc.setFont("helvetica", "normal")
  doc.text(value, x, yMm)
}

/** 0176… → +49176… (nur für „Tel.:“-Zeile wie im Muster) */
function deTelInternational(phone: string): string {
  const raw = phone.trim().replace(/[\s/-]/g, "")
  if (raw.startsWith("+")) return phone.trim()
  if (raw.startsWith("00")) return "+" + raw.slice(2)
  if (raw.startsWith("0")) return "+49" + raw.slice(1)
  return phone.trim()
}

/**
 * Absenderblock nach klassischer Vorlage (Fensterbrief):
 * Firma → Adresse → Mobil → Mail → Bank → Adresswiederholung → Tel. → USt → St-Nr. → HRB → Amtsgericht
 */
export function drawMwStSenderBlock(doc: jsPDF, y0Mm: number): number {
  const s = BILLING_SENDER
  const x = INV_DE_LAYOUT.marginLeft
  let y = y0Mm
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text(s.name, x, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(s.address.street, x, y)
  y += 4.2
  doc.text(`${s.address.zip} ${s.address.city}`, x, y)
  y += 4.2

  const mobilShown = (s.mobile.trim() || s.phone.trim()) || ""
  if (mobilShown) {
    doc.text(`Mobil: ${mobilShown}`, x, y)
    y += 4.2
  }
  if (s.email.trim()) {
    doc.text(`Mail: ${s.email.trim()}`, x, y)
    y += 4.2
  }
  if (s.bank.name.trim()) {
    doc.text(s.bank.name.trim(), x, y)
    y += 4.2
  }
  if (s.bank.iban.trim()) {
    doc.text(`IBAN ${s.bank.iban.trim()}`, x, y)
    y += 4.2
  }
  if (s.bank.bic.trim()) {
    doc.text(s.bank.bic.trim(), x, y)
    y += 4.2
  }

  doc.text(s.address.street, x, y)
  y += 4.2
  doc.text(`${s.address.zip} ${s.address.city}`, x, y)
  y += 4.2

  if (s.phone.trim()) {
    doc.text(`Tel.: ${deTelInternational(s.phone.trim())}`, x, y)
    y += 4.2
  }

  if (s.vatId.trim()) {
    doc.text(`USt-ID-Nr.: ${s.vatId.trim()}`, x, y)
    y += 4.2
  }
  if (s.taxNumber.trim()) {
    doc.text(`StNr.: ${s.taxNumber.trim()}`, x, y)
    y += 4.2
  }
  if (s.courtRegistration.trim()) {
    doc.text(s.courtRegistration.trim(), x, y)
    y += 4.2
  }
  if (s.registryCourt.trim()) {
    doc.text(s.registryCourt.trim(), x, y)
    y += 4.2
  }
  return y + 3
}

/**
 * Empfängerblock + rechte Spalte für Belegnummer(n) — Rechnung, Gutschrift, Storno.
 * Optional zweite Referenz (z. B. „Storniert“ → Ursprungsbeleg).
 */
export function drawMwStRecipientAndDocs(
  doc: jsPDF,
  y0Mm: number,
  t: Pick<ResolvedInvoiceDocTemplate, "customerNumberLabel" | "dateLabel">,
  meta: {
    recipientName: string
    recipientEmail: string
    customerNumber: string | null
    dateStr: string
    docRightLabel: string
    docRightValue: string
    docRightExtraLabel?: string
    docRightExtraValue?: string
  }
): number {
  const xl = INV_DE_LAYOUT.marginLeft
  const xr = INV_DE_LAYOUT.recipientSecondColX
  let y = y0Mm
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text("Name", xl, y)
  doc.text(t.customerNumberLabel.replace(/\s*:\s*$/, ""), xr, y)
  y += 4
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.text(meta.recipientName, xl, y)
  doc.text(meta.customerNumber?.trim() || "—", xr, y)
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text("Straße, Hausnummer", xl, y)
  doc.text(meta.docRightLabel.replace(/\s*:\s*$/, ""), xr, y)
  y += 4
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.text("—", xl, y)
  doc.text(meta.docRightValue, xr, y)
  y += 5
  if (meta.docRightExtraLabel?.trim() && meta.docRightExtraValue != null && meta.docRightExtraValue !== "") {
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text("PLZ Ort", xl, y)
    doc.text(meta.docRightExtraLabel.replace(/\s*:\s*$/, ""), xr, y)
    y += 4
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.text("—", xl, y)
    doc.text(meta.docRightExtraValue, xr, y)
    y += 5
  } else {
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text("PLZ Ort", xl, y)
    y += 4
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.text("—", xl, y)
    y += 5
  }
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text("Land", xl, y)
  y += 4
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.text(BILLING_SENDER.address.country || "Deutschland", xl, y)
  y += 5
  doc.setFontSize(9)
  doc.text(`${t.dateLabel} ${meta.dateStr}`, xl, y)
  y += 4
  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  doc.text(meta.recipientEmail, xl, y)
  return y + 6
}

/** Rechnung / Wallet: rechte Spalte = documentNumberLabel + Belegnummer */
export function drawMwStRecipientAndInvoiceMeta(
  doc: jsPDF,
  y0Mm: number,
  t: Pick<ResolvedInvoiceDocTemplate, "documentNumberLabel" | "customerNumberLabel" | "dateLabel">,
  meta: {
    recipientName: string
    recipientEmail: string
    invoiceNumber: string
    customerNumber: string | null
    dateStr: string
  }
): number {
  return drawMwStRecipientAndDocs(doc, y0Mm, t, {
    recipientName: meta.recipientName,
    recipientEmail: meta.recipientEmail,
    customerNumber: meta.customerNumber,
    dateStr: meta.dateStr,
    docRightLabel: t.documentNumberLabel,
    docRightValue: meta.invoiceNumber,
  })
}

/** Positions-/Detailblock ohne MwSt-Tabelle (Gutschrift, Storno) */
export function drawMwStDetailRowsBlock(
  doc: jsPDF,
  y0Mm: number,
  sectionTitle: string,
  rows: { left: string; right: string }[]
): number {
  let y = y0Mm
  const xl = INV_DE_LAYOUT.marginLeft
  const rightEdge = INV_DE_LAYOUT.contentRightMm
  const leftColW = INV_DE_LAYOUT.contentWidthMm - 50
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(sectionTitle, xl, y)
  y += 7
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.line(xl, y, rightEdge, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  for (const row of rows) {
    if (row.left.trim()) {
      const leftLines = doc.splitTextToSize(row.left.trim(), leftColW)
      doc.text(leftLines, xl, y)
    }
    if (row.right.trim()) {
      textRight(doc, row.right.trim(), rightEdge, y)
    }
    const linesH = Math.max(1, row.left.trim() ? doc.splitTextToSize(row.left.trim(), leftColW).length : 1)
    y += Math.max(5, linesH * 4.2)
  }
  return y + 4
}

/**
 * Rechnungskopf nach DIN 5008 Form B: kleingedruckter Absender, Empfänger im Anschriftfeld,
 * Kommunikationsangaben (Datum, Kundennummer, Rechnungsnr.) rechtsbündig, optional Logo oben rechts.
 */
export async function drawHtmlTemplateInvoiceHeader(
  doc: jsPDF,
  branding: Pick<InvoiceBrandingDTO, "logoUrl">,
  meta: {
    recipientName: string
    recipientEmail: string
    /** Straße + Hausnr. (Rechnungsdaten) */
    recipientStreetLine: string
    /** PLZ + Ort (Rechnungsdaten) */
    recipientCityLine: string
    /** Land des Rechnungsempfängers (aus invoiceData.country) */
    recipientCountry: string
    customerNumber: string | null
    invoiceNumber: string
    dateStr: string
    customerNumberLabel: string
    dateLabel: string
    documentNumberLabel: string
    /** Optional zweite Zeile rechts (z. B. Storniert: RE-…) */
    secondDocumentLabel?: string | null
    secondDocumentValue?: string | null
  }
): Promise<number> {
  const s = BILLING_SENDER
  const d = DIN_5008_MM
  const x0 = d.textLeft
  const rightX = INV_DE_LAYOUT.contentRightMm
  const addrW = d.addressFieldWidth

  await drawLogo(doc, branding.logoUrl, rightX - 42, 10, 40)

  const senderOneLiner =
    `${s.name} · ${s.address.street} · ${s.address.zip} ${s.address.city} · ${s.address.country || "Germany"}`.trim()
  const [tr, tg, tb] = INV_DE_COLORS.text
  doc.setFont("helvetica", "normal")
  doc.setFontSize(d.returnAddressPt)
  doc.setTextColor(tr, tg, tb)
  const returnLines = doc.splitTextToSize(senderOneLiner, addrW - 1)
  const yRet0 = d.returnAddressBaseline
  doc.text(returnLines, x0, yRet0)
  const lhRet = cssLineHeightMm(doc, d.returnAddressPt)
  const lastReturnBaseline = yRet0 + (returnLines.length - 1) * lhRet
  const underlineY = lastReturnBaseline + 1.2
  const [br, bg, bb] = INV_DE_COLORS.borderSender
  doc.setDrawColor(br, bg, bb)
  doc.setLineWidth(0.35)
  doc.line(x0, underlineY, x0 + addrW, underlineY)
  doc.setDrawColor(0, 0, 0)

  let y = d.recipientFirstBaseline
  const blockTopY = y
  doc.setFontSize(INV_DE_LAYOUT.bodyPt)
  doc.text(meta.recipientName, x0, y)
  y += d.addressLineStep
  doc.text(meta.recipientStreetLine.trim() || "—", x0, y)
  y += d.addressLineStep
  doc.text(meta.recipientCityLine.trim() || "—", x0, y)
  y += d.addressLineStep
  doc.text(meta.recipientCountry, x0, y)
  y += d.addressLineStep
  doc.setFontSize(INV_DE_LAYOUT.senderPt)
  const [fr, fg, fb] = INV_DE_COLORS.footer
  doc.setTextColor(fr, fg, fb)
  doc.text(meta.recipientEmail, x0, y)
  y += d.addressLineStep

  const dLab = meta.dateLabel.trim().endsWith(":") ? meta.dateLabel.trim() : `${meta.dateLabel.trim()}:`
  const kdLab =
    meta.customerNumberLabel.trim().endsWith(":") ?
      meta.customerNumberLabel.trim()
    : `${meta.customerNumberLabel.trim()}:`
  const invLab =
    meta.documentNumberLabel.trim().endsWith(":") ?
      meta.documentNumberLabel.trim()
    : `${meta.documentNumberLabel.trim()}:`

  doc.setTextColor(tr, tg, tb)
  const metaPt = INV_DE_LAYOUT.bodyPt
  let my = blockTopY
  textRightBoldLabelValue(doc, dLab, meta.dateStr, rightX, my, metaPt)
  my += d.addressLineStep
  textRightBoldLabelValue(doc, kdLab, meta.customerNumber?.trim() || "—", rightX, my, metaPt)
  my += d.addressLineStep
  textRightBoldLabelValue(doc, invLab, meta.invoiceNumber, rightX, my, metaPt)
  my += d.addressLineStep
  const secL = meta.secondDocumentLabel?.trim()
  const secV = meta.secondDocumentValue?.trim()
  if (secL && secV) {
    const sLab = secL.endsWith(":") ? secL : `${secL}:`
    textRightBoldLabelValue(doc, sLab, secV, rightX, my, metaPt)
    my += d.addressLineStep
  }

  return Math.max(y, my) + d.gapAfterAddressMm
}

/** Positionsblock wie RE (fette Überschrift, schwarze Linie, Zeilen links/rechts) — GS/SR/SG. */
export function drawHtmlTemplateDetailRowsBlock(
  doc: jsPDF,
  y0Mm: number,
  sectionTitle: string | null,
  rows: { left: string; right: string }[]
): number {
  const x0 = INV_DE_LAYOUT.marginLeft
  const rightX = INV_DE_LAYOUT.contentRightMm
  const pad = INV_DE_LAYOUT.tableCellPadMm
  const [tr, tg, tb] = INV_DE_COLORS.text
  const [rr, rg, rb] = INV_DE_COLORS.borderRow
  const bodyPt = INV_DE_LAYOUT.bodyPt
  const lh = cssLineHeightMm(doc, bodyPt)
  const amountW = 42
  const leftW = Math.max(48, INV_DE_LAYOUT.contentWidthMm - amountW - pad * 2)
  let y = y0Mm

  if (sectionTitle?.trim()) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(bodyPt)
    doc.setTextColor(tr, tg, tb)
    doc.text(sectionTitle.trim(), x0, y)
    y += pad * 0.35 + lh
  }

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.55)
  doc.line(x0, y, rightX, y)
  y += pad + 1.2

  doc.setFont("helvetica", "normal")
  doc.setFontSize(bodyPt)
  doc.setTextColor(tr, tg, tb)

  for (const row of rows) {
    const lt = row.left.trim()
    const rt = row.right.trim()
    if (lt) {
      const leftLines = doc.splitTextToSize(lt, leftW)
      doc.text(leftLines, x0, y)
      if (rt) textRight(doc, rt, rightX - pad, y)
      const rowH = Math.max(pad + lh, (leftLines.length - 1) * lh + pad + lh * 0.5)
      y += rowH
    } else if (rt) {
      textRight(doc, rt, rightX - pad, y)
      y += pad + lh
    }
  }

  doc.setDrawColor(rr, rg, rb)
  doc.setLineWidth(0.2)
  doc.line(x0, y, rightX, y)
  return y + INV_DE_LAYOUT.tableMarginV * 0.6
}

/** Zeilenabstand ~ CSS line-height 1.4 für gegebene Schriftgröße (pt) */
function cssLineHeightMm(_doc: jsPDF, fontPt: number): number {
  return (fontPt * 1.4 * 25.4) / 72
}

/**
 * Positionstabelle + Summen: Lfd. / Leistung / Betrag (netto); Summenzeilen mit Label links (x0), Betrag rechts;
 * Trennlinie vor Schlusszeile über volle Inhaltsbreite.
 */
export function drawHtmlTemplateInvoiceTableAndTotals(
  doc: jsPDF,
  y0Mm: number,
  opts: {
    sectionTitle: string | null
    lineDescription: string
    netCents: number
    vatCents: number
    grossCents: number
    vatPercent: number
  }
): number {
  const x0 = INV_DE_LAYOUT.marginLeft
  const rightX = INV_DE_LAYOUT.contentRightMm
  const pad = INV_DE_LAYOUT.tableCellPadMm
  const [tr, tg, tb] = INV_DE_COLORS.text
  const [rr, rg, rb] = INV_DE_COLORS.borderRow

  let y = y0Mm
  if (opts.sectionTitle?.trim()) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(INV_DE_LAYOUT.bodyPt)
    doc.setTextColor(tr, tg, tb)
    doc.text(opts.sectionTitle.trim(), x0, y)
    y += cssLineHeightMm(doc, INV_DE_LAYOUT.bodyPt) + 2
  }

  /** Eigene schmale Spalte für „Lfd. Nr.“ / Zeilennummer — verhindert Überlappung mit „Erhaltene Leistung“ */
  const xLfd = x0 + Math.max(pad * 0.5, 1.5)
  const colLfdMm = 20
  const xLeist = xLfd + colLfdMm
  const innerRight = rightX - pad
  const netColW = 34
  const xNetColLeft = innerRight - netColW
  const leistW = Math.max(42, xNetColLeft - xLeist - pad)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(INV_DE_LAYOUT.bodyPt)
  doc.setTextColor(tr, tg, tb)
  doc.text("Lfd. Nr.", xLfd, y)
  doc.text("Erhaltene Leistung", xLeist, y)
  textRight(doc, "Betrag (netto):", rightX - pad, y)
  y += pad * 0.35
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.55)
  doc.line(x0, y, rightX, y)
  y += (pad + 1.2) * 1.5

  doc.setFont("helvetica", "normal")
  doc.setFontSize(INV_DE_LAYOUT.bodyPt)
  doc.text("1", xLfd, y)
  const descLines = doc.splitTextToSize(opts.lineDescription, leistW)
  doc.text(descLines, xLeist, y)
  textRight(doc, formatEuroDe(opts.netCents), rightX - pad, y)
  const lh = cssLineHeightMm(doc, INV_DE_LAYOUT.bodyPt)
  const rowH = Math.max(pad + lh, (descLines.length - 1) * lh + pad + lh * 0.5)
  y += rowH
  doc.setDrawColor(rr, rg, rb)
  doc.setLineWidth(0.2)
  doc.line(x0, y, rightX, y)
  y += INV_DE_LAYOUT.totalsMarginTop

  doc.setFont("helvetica", "normal")
  doc.setFontSize(INV_DE_LAYOUT.bodyPt)
  doc.setTextColor(tr, tg, tb)
  const rowPad = INV_DE_LAYOUT.totalsRowPad
  const amtRight = rightX - pad
  /** Summen-Labels ab Mitte der Inhaltsbreite (nicht am linken Rand) */
  const totalsLabelX = x0 + INV_DE_LAYOUT.contentWidthMm / 2
  doc.text("Betrag ohne Mwst:", totalsLabelX, y)
  textRight(doc, formatEuroDe(opts.netCents), amtRight, y)
  y += rowPad + lh
  doc.text(`MwSt. ${opts.vatPercent} %:`, totalsLabelX, y)
  textRight(doc, formatEuroDe(opts.vatCents), amtRight, y)
  y += rowPad + lh * 0.4
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.4)
  doc.line(x0, y, rightX, y)
  y += lh * 1.5
  doc.setFont("helvetica", "bold")
  doc.text("Gesamtbetrag (brutto):", totalsLabelX, y)
  textRight(doc, formatEuroDe(opts.grossCents), amtRight, y)
  y += lh
  return y + INV_DE_LAYOUT.tableMarginV * 0.6
}

/**
 * MwSt.-Tabelle wie Vorlage: Kopfzeile 1 „Lfd. Nr. | Erhaltene Leistung | Betrag ohne MwSt.“,
 * Kopfzeile 2 darunter „MwSt X% | Betrag MwSt“ (rechtsbündig unter den Betragsspalten).
 */
export function drawMwStServiceTable(
  doc: jsPDF,
  y0Mm: number,
  sectionTitle: string,
  lineDescription: string,
  netCents: number,
  vatCents: number,
  grossCents: number,
  vatPercent: number
): number {
  const xl = INV_DE_LAYOUT.marginLeft
  const rightEdge = INV_DE_LAYOUT.contentRightMm
  /** Rechte Kante Spalte Netto (einheitlich für Überschrift + Daten) */
  const colNetRight = 118
  /** MwSt-% und MwSt-Betrag (zweite Kopfzeile) */
  const colVatPctRight = 152
  const colVatAmtRight = rightEdge
  const xLeist = xl + 8
  const leistWidthMm = colNetRight - xLeist - 6
  let y = y0Mm

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(sectionTitle, xl, y)
  y += 6

  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text("Lfd. Nr.", xl, y)
  doc.text("Erhaltene Leistung", xLeist, y)
  textRight(doc, "Betrag ohne MwSt.", colNetRight, y)
  y += 4
  textRight(doc, `MwSt ${vatPercent}%`, colVatPctRight, y)
  textRight(doc, "Betrag MwSt", colVatAmtRight, y)
  y += 2
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.2)
  doc.line(xl, y, rightEdge, y)
  y += 5

  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text("1", xl, y)
  const descLines = doc.splitTextToSize(lineDescription, leistWidthMm)
  doc.text(descLines, xLeist, y)
  textRight(doc, formatEuroDe(netCents), colNetRight, y)
  textRight(doc, `${vatPercent} %`, colVatPctRight, y)
  textRight(doc, formatEuroDe(vatCents), colVatAmtRight, y)
  const descH = Math.max(5, (descLines.length - 1) * 4 + 5)
  y += descH

  doc.line(xl, y, rightEdge, y)
  y += 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Gesamtbetrag", xLeist, y)
  textRight(doc, formatEuroDe(grossCents), colVatAmtRight, y)
  return y + 10
}

/** Rechnung / Wallet-Top-up: Zahlungshinweis + optional Fußtext + Abschlusszeile + Signaturhinweis */
export function drawPaymentClosingAndFooter(
  doc: jsPDF,
  opts: {
    paymentNote: string
    closingLine: string
    footerText: string | null
    signatureNote?: string | null
  },
  paymentY: number
): void {
  const x0 = INV_DE_LAYOUT.marginLeft
  const textW = INV_DE_LAYOUT.contentWidthMm
  const [tr, tg, tb] = INV_DE_COLORS.text
  const [dr, dg, db] = INV_DE_COLORS.disclaimer

  const lh = cssLineHeightMm(doc, INV_DE_LAYOUT.bodyPt)
  let y = paymentY
  if (opts.paymentNote.trim()) {
    doc.setFontSize(INV_DE_LAYOUT.bodyPt)
    doc.setTextColor(tr, tg, tb)
    doc.setFont("helvetica", "normal")
    const payLines = doc.splitTextToSize(opts.paymentNote.trim(), textW)
    doc.text(payLines, x0, y)
    y += payLines.length * lh + INV_DE_LAYOUT.signatureMarginTop * 0.35
  }
  if (opts.footerText?.trim()) {
    doc.setFontSize(INV_DE_LAYOUT.senderPt)
    const lines = doc.splitTextToSize(opts.footerText.trim(), textW).slice(0, 14)
    doc.text(lines, x0, y)
    y += lines.length * cssLineHeightMm(doc, INV_DE_LAYOUT.senderPt) + 4
  }
  y += INV_DE_LAYOUT.signatureMarginTop * 0.25
  doc.setFontSize(INV_DE_LAYOUT.bodyPt)
  doc.setFont("helvetica", "italic")
  const closingParaGap = lh * 0.35
  const closingBlocks = opts.closingLine.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  for (let ci = 0; ci < closingBlocks.length; ci++) {
    for (const seg of closingBlocks[ci].split(/\n/)) {
      const wrapped = doc.splitTextToSize(seg.trimEnd(), textW)
      doc.text(wrapped, x0, y)
      y += wrapped.length * lh
    }
    if (ci < closingBlocks.length - 1) y += closingParaGap
  }
  y += INV_DE_LAYOUT.disclaimerMarginTop
  doc.setFont("helvetica", "normal")
  if (opts.signatureNote?.trim()) {
    doc.setFontSize(INV_DE_LAYOUT.disclaimerPt)
    doc.setTextColor(dr, dg, db)
    const sn = doc.splitTextToSize(opts.signatureNote.trim(), textW).slice(0, 6)
    doc.text(sn, x0, y)
  }
}

/** Seitenunterkante (mm) — A4 Standard */
function getPageHeightMm(doc: jsPDF): number {
  const internal = doc.internal as unknown as {
    pageSize: { getHeight?: () => number; height: number }
  }
  if (internal.pageSize.getHeight) return internal.pageSize.getHeight()
  return internal.pageSize.height ?? 297
}

/** IBAN mit Leerzeichen zu Vierergruppen (nur Darstellung). */
function formatIbanForFooter(iban: string): string {
  const c = iban.replace(/\s/g, "").toUpperCase()
  if (!c) return ""
  return c.replace(/(.{4})/g, "$1 ").trim()
}

function footerWrappedLines(doc: jsPDF, text: string, colWmm: number): number {
  const t = text.trim()
  if (!t) return 0
  return doc.splitTextToSize(t, colWmm).length
}

/** Zeilenanzahl wie beim Druck: Spaltenkopf immer fett messen (breiter → ggf. mehr Zeilen). */
function footerTitleLineCount(doc: jsPDF, label: string, colWmm: number, fontPt: number): number {
  doc.setFontSize(fontPt)
  doc.setFont("helvetica", "bold")
  const n = footerWrappedLines(doc, label, colWmm)
  doc.setFont("helvetica", "normal")
  return Math.max(n, 1)
}

const FOOTER_COL_TITLE_BANK = "Bankverbindung"
const FOOTER_COL_TITLE_ADDR = "Adresse"
const FOOTER_COL_TITLE_LEGAL = "Rechtliche Angaben"

/**
 * Dreispaltiger Fuß: Spalte 1 Bankverbindung | Spalte 2 Adresse (+ Tel.) | Spalte 3 Rechtliche Angaben.
 * Wird am Seitenende gezeichnet (fixer Abstand zum unteren Rand).
 */
export function drawMwStTripleColumnPageFooter(doc: jsPDF): void {
  const s = BILLING_SENDER
  const pageH = getPageHeightMm(doc)
  const x0 = INV_DE_LAYOUT.marginLeft
  const xMax = INV_DE_LAYOUT.contentRightMm
  const gap = INV_DE_LAYOUT.footerColGap
  const usable = xMax - x0
  const colW = (usable - 2 * gap) / 3
  const xBank = x0
  const xAddr = x0 + colW + gap
  const xLegal = x0 + 2 * (colW + gap)
  const marginBottom = INV_DE_LAYOUT.marginFooterB

  doc.setFont("helvetica", "normal")
  doc.setFontSize(INV_DE_LAYOUT.footerPt)
  const footPt = INV_DE_LAYOUT.footerPt
  const lineH = cssLineHeightMm(doc, footPt)

  const titleLinesBank = footerTitleLineCount(doc, FOOTER_COL_TITLE_BANK, colW, footPt)
  let bodyLinesBank = 0
  if (s.bank.name.trim()) bodyLinesBank += footerWrappedLines(doc, s.bank.name.trim(), colW)
  if (s.bank.iban.trim()) {
    bodyLinesBank += footerWrappedLines(doc, `IBAN ${formatIbanForFooter(s.bank.iban.trim())}`, colW)
  }
  if (s.bank.bic.trim()) bodyLinesBank += 1
  const hBank = (titleLinesBank + Math.max(bodyLinesBank, 0)) * lineH

  const tel = s.phone.trim() || s.mobile.trim()
  const addrLine1 = s.address.street.trim()
  const addrLine2 = `${s.address.zip} ${s.address.city}`.trim()
  const titleLinesAddr = footerTitleLineCount(doc, FOOTER_COL_TITLE_ADDR, colW, footPt)
  let bodyLinesAddr = footerWrappedLines(doc, addrLine1, colW) + footerWrappedLines(doc, addrLine2, colW)
  if (tel) bodyLinesAddr += 1
  const hAddr = (titleLinesAddr + bodyLinesAddr) * lineH

  const titleLinesLegal = footerTitleLineCount(doc, FOOTER_COL_TITLE_LEGAL, colW, footPt)
  let bodyLinesLegal = 0
  if (s.vatId.trim()) bodyLinesLegal += footerWrappedLines(doc, `USt-ID-Nr: ${s.vatId.trim()}`, colW)
  if (s.taxNumber.trim()) bodyLinesLegal += 1
  if (s.courtRegistration.trim()) bodyLinesLegal += footerWrappedLines(doc, s.courtRegistration.trim(), colW)
  if (s.registryCourt.trim()) bodyLinesLegal += footerWrappedLines(doc, s.registryCourt.trim(), colW)
  const hLegal = (titleLinesLegal + bodyLinesLegal) * lineH

  const blockH = Math.max(hBank, hAddr, hLegal, lineH * 2)
  let yTop = pageH - marginBottom - blockH
  const yMin = INV_DE_LAYOUT.marginTop + 30
  if (yTop < yMin) yTop = yMin

  const [er, eg, eb] = INV_DE_COLORS.borderRow
  doc.setDrawColor(er, eg, eb)
  doc.setLineWidth(0.2)
  doc.line(x0, yTop - INV_DE_LAYOUT.footerPadTop * 0.25, xMax, yTop - INV_DE_LAYOUT.footerPadTop * 0.25)

  const [fr, fg, fb] = INV_DE_COLORS.footer
  doc.setTextColor(fr, fg, fb)

  const drawColTitle = (label: string, xCol: number, yStart: number): number => {
    doc.setFontSize(footPt)
    doc.setFont("helvetica", "bold")
    const tl = doc.splitTextToSize(label, colW)
    doc.text(tl, xCol, yStart)
    doc.setFont("helvetica", "normal")
    return yStart + tl.length * lineH
  }

  let y = yTop
  y = drawColTitle(FOOTER_COL_TITLE_BANK, xBank, y)
  if (s.bank.name.trim()) {
    const lines = doc.splitTextToSize(s.bank.name.trim(), colW)
    doc.text(lines, xBank, y)
    y += lines.length * lineH
  }
  if (s.bank.iban.trim()) {
    const ibanShown = formatIbanForFooter(s.bank.iban.trim())
    const lines = doc.splitTextToSize(`IBAN ${ibanShown}`, colW)
    doc.text(lines, xBank, y)
    y += lines.length * lineH
  }
  if (s.bank.bic.trim()) {
    doc.text(s.bank.bic.trim().toUpperCase(), xBank, y)
  }

  y = yTop
  y = drawColTitle(FOOTER_COL_TITLE_ADDR, xAddr, y)
  if (addrLine1) {
    const lines = doc.splitTextToSize(addrLine1, colW)
    doc.text(lines, xAddr, y)
    y += lines.length * lineH
  }
  if (addrLine2) {
    const lines = doc.splitTextToSize(addrLine2, colW)
    doc.text(lines, xAddr, y)
    y += lines.length * lineH
  }
  if (tel) {
    doc.text(`Tel.: ${tel}`, xAddr, y)
  }

  y = yTop
  y = drawColTitle(FOOTER_COL_TITLE_LEGAL, xLegal, y)
  if (s.vatId.trim()) {
    const lines = doc.splitTextToSize(`USt-ID-Nr: ${s.vatId.trim()}`, colW)
    doc.text(lines, xLegal, y)
    y += lines.length * lineH
  }
  if (s.taxNumber.trim()) {
    doc.text(`StNr.: ${s.taxNumber.trim()}`, xLegal, y)
    y += lineH
  }
  if (s.courtRegistration.trim()) {
    const lines = doc.splitTextToSize(s.courtRegistration.trim(), colW)
    doc.text(lines, xLegal, y)
    y += lines.length * lineH
  }
  if (s.registryCourt.trim()) {
    const lines = doc.splitTextToSize(s.registryCourt.trim(), colW)
    doc.text(lines, xLegal, y)
  }
}

/** Gutschrift / Storno: Fußtext + Abschluss + optional Signaturhinweis (ab startYMm oder Seitenende) */
export function drawClosingAndFooter(
  doc: jsPDF,
  opts: { closingLine: string; footerText: string | null; signatureNote?: string | null },
  startYMm?: number
): void {
  const xl = INV_DE_LAYOUT.marginLeft
  const tw = INV_DE_LAYOUT.contentWidthMm
  let y = startYMm != null ? startYMm + 6 : 238
  if (opts.footerText?.trim()) {
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    const lines = doc.splitTextToSize(opts.footerText.trim(), tw).slice(0, 14)
    doc.text(lines, xl, y)
    y += lines.length * 3.5 + 5
  }
  doc.setFontSize(9)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(0, 0, 0)
  const lhClose = cssLineHeightMm(doc, 9)
  const closingParaGap = lhClose * 0.35
  const closingBlocks = opts.closingLine.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  for (let ci = 0; ci < closingBlocks.length; ci++) {
    for (const seg of closingBlocks[ci].split(/\n/)) {
      const wrapped = doc.splitTextToSize(seg.trimEnd(), tw)
      doc.text(wrapped, xl, y)
      y += wrapped.length * lhClose
    }
    if (ci < closingBlocks.length - 1) y += closingParaGap
  }
  y += 4
  doc.setFont("helvetica", "normal")
  if (opts.signatureNote?.trim()) {
    doc.setFontSize(7)
    doc.setTextColor(70, 70, 70)
    const sn = doc.splitTextToSize(opts.signatureNote.trim(), tw).slice(0, 4)
    doc.text(sn, xl, y)
  }
}

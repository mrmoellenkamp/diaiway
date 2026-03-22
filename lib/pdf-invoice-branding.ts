import "server-only"

import type jsPDF from "jspdf"
import sharp from "sharp"

import type { InvoiceBrandingDTO } from "./invoice-branding"

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
  branding: Pick<InvoiceBrandingDTO, "accentHex" | "logoUrl">
): Promise<void> {
  const { r, g, b } = hexToRgb(branding.accentHex)
  doc.setTextColor(r, g, b)
  doc.setFontSize(18)
  doc.text(title, 20, 22)
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.4)
  doc.line(20, 26, 100, 26)
  doc.setDrawColor(0, 0, 0)
  if (branding.logoUrl?.trim()) {
    await drawLogo(doc, branding.logoUrl.trim(), 120, 4, 58)
  }
}

async function drawLogo(doc: jsPDF, url: string, x: number, y: number, maxWmm: number): Promise<void> {
  try {
    const res = await fetch(url)
    if (!res.ok) return
    const buf = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(buf).metadata()
    const iw = meta.width || 1
    const ih = meta.height || 1
    const wmm = maxWmm
    const hmm = (wmm * ih) / iw
    const jpeg = await sharp(buf)
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer()
    const b64 = jpeg.toString("base64")
    doc.addImage(b64, "JPEG", x, y, wmm, hmm)
  } catch {
    // Logo fehlt oder ungültig — PDF ohne Logo
  }
}

/** Rechnung / Wallet-Top-up: Zahlungshinweis + optional Fußtext + Abschlusszeile */
export function drawPaymentClosingAndFooter(
  doc: jsPDF,
  opts: { paymentNote: string; closingLine: string; footerText: string | null },
  paymentY: number
): void {
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(opts.paymentNote, 20, paymentY)
  let y = 238
  if (opts.footerText?.trim()) {
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(opts.footerText.trim(), 170).slice(0, 14)
    doc.text(lines, 20, y)
    y += lines.length * 3.5 + 5
  }
  doc.setFontSize(8)
  doc.text(opts.closingLine, 20, Math.min(Math.max(y, 258), 282))
}

/** Gutschrift / Storno: nur Abschlusszeile + optional Fußtext */
export function drawClosingAndFooter(
  doc: jsPDF,
  opts: { closingLine: string; footerText: string | null }
): void {
  let y = 238
  if (opts.footerText?.trim()) {
    doc.setFontSize(8)
    const lines = doc.splitTextToSize(opts.footerText.trim(), 170).slice(0, 14)
    doc.text(lines, 20, y)
    y += lines.length * 3.5 + 5
  }
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  doc.text(opts.closingLine, 20, Math.min(Math.max(y, 258), 282))
}

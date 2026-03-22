import "server-only"

import { prisma } from "@/lib/db"

export type InvoiceBrandingDTO = {
  id: string
  logoUrl: string | null
  accentHex: string
  footerText: string | null
  paymentNote: string | null
  closingLine: string | null
  /** Pro Belegtyp (re_session, …): optionale Text-Overrides, Roh-JSON aus der DB */
  documentTemplates: unknown
  updatedAt: Date
}

const CACHE_TTL_MS = 60_000
let cache: { at: number; data: InvoiceBrandingDTO } | null = null

export async function getInvoiceBrandingCached(): Promise<InvoiceBrandingDTO> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data
  }
  let row = await prisma.invoiceBranding.findUnique({ where: { id: "default" } })
  if (!row) {
    row = await prisma.invoiceBranding.create({
      data: { id: "default" },
    })
  }
  const data: InvoiceBrandingDTO = {
    id: row.id,
    logoUrl: row.logoUrl,
    accentHex: row.accentHex,
    footerText: row.footerText,
    paymentNote: row.paymentNote,
    closingLine: row.closingLine,
    documentTemplates: row.documentTemplates ?? null,
    updatedAt: row.updatedAt,
  }
  cache = { at: Date.now(), data }
  return data
}

export function invalidateInvoiceBrandingCache(): void {
  cache = null
}

import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { INVOICE_DOC_KEYS, type InvoiceDocTemplatePatch } from "@/lib/invoice-doc-templates"
import { invalidateInvoiceBrandingCache } from "@/lib/invoice-branding"

export const runtime = "nodejs"

const templateText = z.union([z.string().max(4000), z.literal(""), z.null()]).optional()

const docTemplatePatchSchema = z
  .object({
    title: templateText,
    documentNumberLabel: templateText,
    recipientLabel: templateText,
    sectionLabel: templateText,
    subjectLine: templateText,
    introductionText: templateText,
    signatureNote: templateText,
    walletLineText: templateText,
    serviceName: templateText,
    customerNumberLabel: templateText,
    paymentNote: templateText,
    closingLine: templateText,
    footerText: templateText,
    stornoNumberLabel: templateText,
    storniertLabel: templateText,
    dateLabel: templateText,
    detailBruttoPrefix: templateText,
    detailFeePrefix: templateText,
    detailNetPrefix: templateText,
    stornoBetragPrefix: templateText,
  })
  .strict()
  .optional()

const documentTemplatesSchema = z
  .object({
    re_session: docTemplatePatchSchema,
    re_wallet: docTemplatePatchSchema,
    gs: docTemplatePatchSchema,
    sr: docTemplatePatchSchema,
    sg: docTemplatePatchSchema,
    re_commission: docTemplatePatchSchema,
  })
  .strict()
  .optional()

const patchSchema = z.object({
  logoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  accentHex: z
    .string()
    .regex(/^#?[0-9A-Fa-f]{6}$/)
    .optional(),
  footerText: z.union([z.string().max(4000), z.literal(""), z.null()]).optional(),
  paymentNote: z.union([z.string().max(600), z.literal(""), z.null()]).optional(),
  closingLine: z.union([z.string().max(600), z.literal(""), z.null()]).optional(),
  documentTemplates: documentTemplatesSchema,
})

function normalizeDocPatch(patch: InvoiceDocTemplatePatch | undefined): InvoiceDocTemplatePatch {
  if (!patch || typeof patch !== "object") return {}
  const out: InvoiceDocTemplatePatch = {}
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v !== "string" || v.trim() === "") continue
    ;(out as Record<string, string>)[k] = v.trim()
  }
  return out
}

/** Nur nicht-leere Overrides speichern; leeres Ergebnis → null in der DB. */
function sanitizeDocumentTemplates(
  raw: z.infer<typeof documentTemplatesSchema>
): Prisma.InputJsonValue | null {
  if (!raw || typeof raw !== "object") return null
  const out: Record<string, InvoiceDocTemplatePatch> = {}
  for (const key of INVOICE_DOC_KEYS) {
    const normalized = normalizeDocPatch(raw[key])
    if (Object.keys(normalized).length > 0) out[key] = normalized
  }
  return Object.keys(out).length > 0 ? (out as Prisma.InputJsonValue) : null
}

function normalizeHex(hex: string): string {
  const h = hex.startsWith("#") ? hex : `#${hex}`
  return h.toLowerCase()
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }) }
  }
  const role = (session.user as { role?: string }).role
  if (role !== "admin") {
    return { error: NextResponse.json({ error: "Kein Admin." }, { status: 403 }) }
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== "admin") {
    return { error: NextResponse.json({ error: "Kein Admin." }, { status: 403 }) }
  }
  return { session }
}

/** GET /api/admin/invoice-branding */
export async function GET() {
  const gate = await requireAdmin()
  if ("error" in gate) return gate.error

  let row = await prisma.invoiceBranding.findUnique({ where: { id: "default" } })
  if (!row) {
    row = await prisma.invoiceBranding.create({ data: { id: "default" } })
  }

  return NextResponse.json({
    id: row.id,
    logoUrl: row.logoUrl,
    accentHex: row.accentHex,
    footerText: row.footerText,
    paymentNote: row.paymentNote,
    closingLine: row.closingLine,
    documentTemplates: row.documentTemplates ?? {},
    updatedAt: row.updatedAt.toISOString(),
  })
}

/** PATCH /api/admin/invoice-branding */
export async function PATCH(req: Request) {
  const gate = await requireAdmin()
  if ("error" in gate) return gate.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe.", details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const createData: Prisma.InvoiceBrandingCreateInput = { id: "default" }
  const updateData: Prisma.InvoiceBrandingUpdateInput = {}

  if (data.logoUrl !== undefined) {
    const v = data.logoUrl === "" || data.logoUrl === null ? null : data.logoUrl
    createData.logoUrl = v
    updateData.logoUrl = v
  }
  if (data.accentHex !== undefined) {
    const v = normalizeHex(data.accentHex)
    createData.accentHex = v
    updateData.accentHex = v
  }
  if (data.footerText !== undefined) {
    const v = data.footerText === "" || data.footerText === null ? null : data.footerText
    createData.footerText = v
    updateData.footerText = v
  }
  if (data.paymentNote !== undefined) {
    const v = data.paymentNote === "" || data.paymentNote === null ? null : data.paymentNote
    createData.paymentNote = v
    updateData.paymentNote = v
  }
  if (data.closingLine !== undefined) {
    const v = data.closingLine === "" || data.closingLine === null ? null : data.closingLine
    createData.closingLine = v
    updateData.closingLine = v
  }
  if (data.documentTemplates !== undefined) {
    const cleaned = sanitizeDocumentTemplates(data.documentTemplates)
    const dt = cleaned === null ? Prisma.JsonNull : cleaned
    createData.documentTemplates = dt
    updateData.documentTemplates = dt
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Keine Felder zum Aktualisieren." }, { status: 400 })
  }

  const row = await prisma.invoiceBranding.upsert({
    where: { id: "default" },
    create: createData,
    update: updateData,
  })

  invalidateInvoiceBrandingCache()

  return NextResponse.json({
    id: row.id,
    logoUrl: row.logoUrl,
    accentHex: row.accentHex,
    footerText: row.footerText,
    paymentNote: row.paymentNote,
    closingLine: row.closingLine,
    documentTemplates: row.documentTemplates ?? {},
    updatedAt: row.updatedAt.toISOString(),
  })
}

type InvoiceType = "privat" | "unternehmen"

type InvoiceData = {
  type?: InvoiceType
  fullName?: string
  street?: string
  houseNumber?: string
  zip?: string
  city?: string
  country?: string
  email?: string
  companyName?: string
  vatId?: string
  taxNumber?: string
  kleinunternehmer?: boolean
}

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function toInvoiceData(value: unknown): InvoiceData {
  if (!value || typeof value !== "object") return {}
  return value as InvoiceData
}

export type InvoiceValidationResult =
  | { ok: true; missingFieldKeys: [] }
  | { ok: false; missingFieldKeys: string[] }

/**
 * Prüft Rechnungsdaten für Zahlungsfreigabe (Shugyo).
 * Liefert maschinenlesbare Feld-Keys für i18n (`invoice.field.*`).
 */
export function validateInvoiceDataForPayment(invoiceDataRaw: unknown): InvoiceValidationResult {
  const invoiceData = toInvoiceData(invoiceDataRaw)
  const type = invoiceData.type

  const baseRequired = ["fullName", "street", "houseNumber", "zip", "city", "country", "email"] as const
  const required =
    type === "unternehmen" ? ([...baseRequired, "companyName"] as const) : baseRequired

  const missing: string[] = []
  if (type !== "privat" && type !== "unternehmen") {
    missing.push("type")
  }

  for (const key of required) {
    if (!asNonEmptyString((invoiceData as Record<string, unknown>)[key])) {
      missing.push(key)
    }
  }

  if (missing.length === 0) return { ok: true, missingFieldKeys: [] }

  return { ok: false, missingFieldKeys: missing }
}

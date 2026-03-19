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

const FIELD_LABELS: Record<string, string> = {
  type: "Typ (Privat/Unternehmen)",
  fullName: "Vollständiger Name",
  street: "Straße",
  houseNumber: "Hausnummer",
  zip: "PLZ",
  city: "Stadt",
  country: "Land",
  email: "E-Mail",
  companyName: "Firmenname",
}

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function toInvoiceData(value: unknown): InvoiceData {
  if (!value || typeof value !== "object") return {}
  return value as InvoiceData
}

export function validateInvoiceDataForPayment(invoiceDataRaw: unknown): {
  ok: boolean
  missingFields: string[]
  message?: string
} {
  const invoiceData = toInvoiceData(invoiceDataRaw)
  const type = invoiceData.type

  const baseRequired = ["fullName", "street", "houseNumber", "zip", "city", "country", "email"]
  const required = type === "unternehmen" ? [...baseRequired, "companyName"] : baseRequired

  const missing: string[] = []
  if (type !== "privat" && type !== "unternehmen") {
    missing.push(FIELD_LABELS.type)
  }

  for (const key of required) {
    if (!asNonEmptyString((invoiceData as Record<string, unknown>)[key])) {
      missing.push(FIELD_LABELS[key] ?? key)
    }
  }

  if (missing.length === 0) return { ok: true, missingFields: [] }

  return {
    ok: false,
    missingFields: missing,
    message: `Bitte vervollständige zuerst deine Rechnungsdaten (${missing.join(", ")}).`,
  }
}


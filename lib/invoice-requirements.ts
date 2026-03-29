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

  /** Anschrift + Kontakt – für Privat und Unternehmen gleich (ohne Namen). */
  const addressAndContact = ["street", "houseNumber", "zip", "city", "country", "email"] as const
  /** Privat: zusätzlich vollständiger Name. Unternehmen: Firmenname Pflicht, vollständiger Name optional. */
  const required =
    type === "unternehmen"
      ? ([...addressAndContact, "companyName"] as const)
      : ([...addressAndContact, "fullName"] as const)

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

/** Land aus User-Rechnungsdaten (`invoiceData.country`), sonst null */
export function invoiceDataCountry(invoiceDataRaw: unknown): string | null {
  const c = toInvoiceData(invoiceDataRaw).country
  if (typeof c !== "string") return null
  const t = c.trim()
  return t || null
}

export type InvoiceDataAddressLines = {
  /** Straße + Hausnummer */
  streetLine: string
  /** PLZ + Ort */
  cityLine: string
}

/**
 * Zwei Anschriftzeilen für den PDF-Rechnungskopf aus `invoiceData`.
 * Fehlende Teile werden weggelassen; ist eine Zeile leer → „—“.
 */
export function invoiceDataAddressLines(invoiceDataRaw: unknown): InvoiceDataAddressLines {
  const d = toInvoiceData(invoiceDataRaw)
  const street = asNonEmptyString(d.street)
  const houseNumber = asNonEmptyString(d.houseNumber)
  const streetLine = [street, houseNumber].filter(Boolean).join(" ").trim() || "—"
  const zip = asNonEmptyString(d.zip)
  const city = asNonEmptyString(d.city)
  const cityLine = [zip, city].filter(Boolean).join(" ").trim() || "—"
  return { streetLine, cityLine }
}

export type InvoiceIntroGreeting = {
  firstName: string
  lastName: string
  username: string
}

function splitFirstAndRest(full: string): { first: string; rest: string } {
  const t = full.trim()
  if (!t) return { first: "", rest: "" }
  const i = t.indexOf(" ")
  if (i === -1) return { first: t, rest: "" }
  return { first: t.slice(0, i).trim(), rest: t.slice(i + 1).trim() }
}

/**
 * Vor-/Nachname (aus Rechnungsdaten bzw. Profilname) und Benutzername für die RE-PDF-Einleitung
 * (Platzhalter {{firstName}}, {{lastName}}, {{username}}).
 */
export function greetingPartsFromInvoiceData(
  invoiceDataRaw: unknown,
  userName: string,
  username: string | null | undefined
): InvoiceIntroGreeting {
  const d = toInvoiceData(invoiceDataRaw)
  const base =
    d.type === "unternehmen"
      ? asNonEmptyString(d.fullName) || asNonEmptyString(d.companyName) || userName.trim()
      : asNonEmptyString(d.fullName) || userName.trim()
  const { first, rest } = splitFirstAndRest(base)
  const un = typeof username === "string" ? username.trim() : ""
  return {
    firstName: first,
    lastName: rest,
    username: un || "—",
  }
}

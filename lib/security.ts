/**
 * Sicherheits-Helfer: XSS-Prevention, sichere Fehlerausgabe.
 */

/** Escaped HTML-Sonderzeichen für sichere Einbettung in HTML. */
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

/**
 * Konvertiert Newlines zu &lt;br/&gt; und escaped zuvor HTML.
 * Nutzen: User-Input sicher in HTML-E-Mails einbetten.
 */
export function textToHtmlSafe(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>")
}

/** Erlaubte Keys für invoiceData (privat/unternehmen) */
const INVOICE_DATA_KEYS = new Set([
  "type", "fullName", "street", "houseNumber", "zip", "city", "country", "email",
  "companyName", "legalForm", "vatId", "taxNumber", "kleinunternehmer",
])

/** Maximale Länge pro String-Feld in invoiceData */
const MAX_INVOICE_FIELD_LEN = 200

/**
 * Validiert und sanitized invoiceData für sichere Speicherung.
 * Gibt null zurück wenn ungültig.
 */
export function sanitizeInvoiceData(obj: unknown): Record<string, unknown> | null {
  if (obj === null || obj === undefined) return null
  if (typeof obj !== "object" || Array.isArray(obj)) return null
  const raw = obj as Record<string, unknown>
  const type = raw.type
  if (type !== "privat" && type !== "unternehmen") return null
  const result: Record<string, unknown> = { type }
  for (const [k, v] of Object.entries(raw)) {
    if (!INVOICE_DATA_KEYS.has(k)) continue
    if (v === null || v === undefined) continue
    if (typeof v === "string") {
      result[k] = v.trim().slice(0, MAX_INVOICE_FIELD_LEN)
    } else if (typeof v === "boolean" && k === "kleinunternehmer") {
      result[k] = v
    }
  }
  return result
}

/**
 * Gibt eine sichere Fehlermeldung für API-Responses.
 * Verhindert Leaks von DB-Interna, Stacktraces oder Implementierungsdetails.
 */
export function sanitizeErrorForClient(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    // Bekannte, sichere Meldungen durchreichen (geprüft)
    if (msg.includes("nicht gefunden") || msg.includes("not found")) return "Nicht gefunden."
    if (msg.includes("bereits") || msg.includes("already")) return "Bereits vorhanden."
    if (msg.includes("ungültig") || msg.includes("invalid")) return "Ungültige Eingabe."
    if (msg.includes("zu viele") || msg.includes("too many")) return "Zu viele Anfragen."
    // Prisma/DB-Fehler nicht durchreichen
    if (msg.includes("prisma") || msg.includes("unique constraint") || msg.includes("foreign key")) {
      return "Ein Fehler ist aufgetreten. Bitte versuche es später erneut."
    }
  }
  return "Ein Fehler ist aufgetreten. Bitte versuche es später erneut."
}

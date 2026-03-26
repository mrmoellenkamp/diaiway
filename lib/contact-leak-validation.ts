/**
 * Serverseitig: keine Kontaktdaten / rohe externe Links in Freitext (Profil-Bio, Chat, Waymail, Projekte).
 * Social-Felder (Instagram etc.) sind separat erlaubt.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const URL_LIKE =
  /\b(https?:\/\/[^\s]+|www\.[^\s]+)\b/i
const PHONE_LIKE = /(?:\+?\d[\d\-\s().]{6,}\d)/

export type ContactLeakResult = { ok: true } | { ok: false; message: string }

const DEFAULT_MESSAGE_DE =
  "Hier sind keine E-Mail-Adressen, Links oder Telefonnummern erlaubt. Nutze dafür die vorgesehenen Felder bzw. die Plattform."

export function validateNoContactLeak(text: string, label?: string): ContactLeakResult {
  const t = typeof text === "string" ? text : ""
  if (!t.trim()) return { ok: true }
  if (EMAIL_RE.test(t)) {
    return { ok: false, message: label ? `${label}: ${DEFAULT_MESSAGE_DE}` : DEFAULT_MESSAGE_DE }
  }
  if (URL_LIKE.test(t)) {
    return { ok: false, message: label ? `${label}: ${DEFAULT_MESSAGE_DE}` : DEFAULT_MESSAGE_DE }
  }
  if (PHONE_LIKE.test(t)) {
    return { ok: false, message: label ? `${label}: ${DEFAULT_MESSAGE_DE}` : DEFAULT_MESSAGE_DE }
  }
  return { ok: true }
}

export function assertContactLeakFree(text: string, label?: string): void {
  const r = validateNoContactLeak(text, label)
  if (!r.ok) throw new Error(r.message)
}

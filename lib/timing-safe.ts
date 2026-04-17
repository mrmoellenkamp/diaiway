import crypto from "crypto"

/**
 * Vergleicht `Bearer <token>` Authorization-Header konstantzeit-sicher.
 * Verhindert Timing-Angriffe auf Cron-/Service-Secrets.
 */
export function safeBearerCompare(authHeader: string | null, expectedToken: string): boolean {
  if (!authHeader || !expectedToken) return false
  const prefix = "Bearer "
  if (!authHeader.startsWith(prefix)) return false
  const received = authHeader.slice(prefix.length).trim()
  return safeStringCompare(received, expectedToken)
}

/**
 * Konstantzeit-Vergleich für beliebige Strings.
 * Gibt false zurück, wenn Längen unterschiedlich — das ist bei Secrets meist harmlos,
 * da die erwartete Länge i.d.R. bekannt ist und nicht aus Timing leakt.
 */
export function safeStringCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    const aBuf = Buffer.from(a)
    const bBuf = Buffer.from(b)
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

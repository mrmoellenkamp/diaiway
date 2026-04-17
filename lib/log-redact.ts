/**
 * Zentrale Fehler-/Log-Redaction.
 *
 * Entfernt typische Secret-Muster (Connection Strings, Bearer Tokens, Passwörter,
 * Stripe Keys, Upstash Tokens, JWT-ähnliche Strings), bevor etwas ins Log geht.
 *
 * Nutzen: verhindert, dass Stacktraces oder serialisierte Fehlerobjekte in
 * Vercel-Logs / Drittanbieter-Logs sensible Daten offenlegen (DSGVO Art. 32,
 * Apple App Store 5.1, Google Play User Data Policy).
 */

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // postgres://user:password@host  → postgres://user:***@host
  [/(postgres(?:ql)?:\/\/[^:@\s/]+:)[^@\s]+@/gi, "$1***@"],
  // mysql:// etc.
  [/((?:mysql|redis|mongodb(?:\+srv)?):\/\/[^:@\s/]+:)[^@\s]+@/gi, "$1***@"],
  // Authorization: Bearer xxx
  [/(authorization\s*[:=]\s*bearer\s+)[A-Za-z0-9._\-~+/=]+/gi, "$1***"],
  // Stripe keys sk_live_…, sk_test_…, rk_…, whsec_…
  [/(sk|rk)_(live|test)_[A-Za-z0-9]{10,}/gi, "$1_$2_***"],
  [/whsec_[A-Za-z0-9]{10,}/gi, "whsec_***"],
  // Upstash / generic REST tokens (long base64ish)
  [/("?(?:token|apiKey|api_key|secret|password|pass|authorization)"?\s*[:=]\s*")[^"]+(")/gi, "$1***$2"],
  [/\b(UPSTASH_[A-Z_]*TOKEN=)[^\s&]+/gi, "$1***"],
  // Generic long bearer-ish tokens in URLs
  [/([?&](?:token|apikey|key|secret)=)[^&#\s]+/gi, "$1***"],
  // JWT (three base64url segments)
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "eyJ***.***.***"],
]

const MAX_LOG_STRING = 2_000

/** Redacts obvious secrets from a string; truncates overly long strings. */
export function redactString(input: string): string {
  let out = input
  for (const [re, replacement] of SECRET_PATTERNS) {
    out = out.replace(re, replacement)
  }
  if (out.length > MAX_LOG_STRING) {
    out = out.slice(0, MAX_LOG_STRING) + "…[truncated]"
  }
  return out
}

function serializeError(err: unknown): string {
  if (err === null || err === undefined) return String(err)
  if (err instanceof Error) {
    const base = `${err.name}: ${err.message}`
    if (process.env.NODE_ENV === "production") return base
    return err.stack ? `${base}\n${err.stack}` : base
  }
  if (typeof err === "object") {
    try {
      return JSON.stringify(err)
    } catch {
      return "[unserializable object]"
    }
  }
  return String(err)
}

/**
 * Zentrale sichere Log-Funktion für Fehler.
 * - Produktion: console.error mit redactedMessage
 * - Dev: console.error mit stacktrace (redacted)
 */
export function logSecureError(context: string, err: unknown, extra?: Record<string, unknown>): void {
  const serialized = serializeError(err)
  const redacted = redactString(serialized)
  if (extra && Object.keys(extra).length > 0) {
    const safeExtra: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(extra)) {
      if (typeof v === "string") safeExtra[k] = redactString(v)
      else safeExtra[k] = v
    }
    console.error(`[${context}]`, redacted, safeExtra)
    return
  }
  console.error(`[${context}]`, redacted)
}

/** Warn-Level, gleiche Redaction. */
export function logSecureWarn(context: string, err: unknown, extra?: Record<string, unknown>): void {
  const serialized = serializeError(err)
  const redacted = redactString(serialized)
  if (extra && Object.keys(extra).length > 0) {
    const safeExtra: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(extra)) {
      if (typeof v === "string") safeExtra[k] = redactString(v)
      else safeExtra[k] = v
    }
    console.warn(`[${context}]`, redacted, safeExtra)
    return
  }
  console.warn(`[${context}]`, redacted)
}

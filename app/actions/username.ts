"use server"

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/

/**
 * Validiert einen Usernamen: min. 3 Zeichen, nur Buchstaben, Ziffern, Unterstrich.
 */
export async function validateUsername(
  username: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = username.trim()
  if (trimmed.length < 3) {
    return { ok: false, error: "Mindestens 3 Zeichen erforderlich." }
  }
  if (trimmed.length > 30) {
    return { ok: false, error: "Maximal 30 Zeichen." }
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return { ok: false, error: "Nur Buchstaben, Ziffern und Unterstrich erlaubt." }
  }
  return { ok: true }
}

/**
 * Generiert einen Fallback-Username: Vorname_Zufallszahl (eindeutig prüfbar via Prisma)
 */
export async function generateFallbackUsername(firstName: string): Promise<string> {
  const clean = firstName
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20) || "user"
  const suffix = Math.floor(10000 + Math.random() * 90000)
  return `${clean}_${suffix}`
}

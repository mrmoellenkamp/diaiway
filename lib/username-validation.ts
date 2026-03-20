/**
 * Benutzername / Anzeigename – reine Validierung (kein "use server", für API-Routen importierbar).
 */

/** Sichtbarer Anzeigename: Länge nach trim (UTF-16 Code Units, wie String.length). */
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 50

/**
 * Verboten: Steuerzeichen, Zeilenumbrüche, Tab, viele unsichtbare / BiDi-Zeichen.
 * Erlaubt: Buchstaben (inkl. Umlaute), Ziffern, Leerzeichen, Satzzeichen, Symbole, Emojis (inkl. ZWJ U+200D).
 */
/* eslint-disable no-control-regex -- Muster ist Absicht */
const USERNAME_FORBIDDEN_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F\u200B\u200C\u200E\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF]/u
/* eslint-enable no-control-regex */

/**
 * Validiert einen Usernamen (Anzeigename): 3–50 Zeichen, keine Steuer-/Linebreak-/unsichtbaren Zeichen.
 */
export function validateUsername(
  username: string
): { ok: true } | { ok: false; error: string } {
  const trimmed = username.trim()
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return { ok: false, error: `Mindestens ${USERNAME_MIN_LENGTH} Zeichen erforderlich.` }
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: `Maximal ${USERNAME_MAX_LENGTH} Zeichen.` }
  }
  if (USERNAME_FORBIDDEN_CHARS.test(trimmed)) {
    return {
      ok: false,
      error:
        "Unzulässige Zeichen: keine Zeilenumbrüche, Tabs, Steuerzeichen oder unsichtbare Zeichen.",
    }
  }
  return { ok: true }
}

/**
 * Fallback-Username: Vorname_Zufallszahl (für Migrationen / interne Nutzung).
 */
export function generateFallbackUsername(firstName: string): string {
  const clean =
    firstName
      .trim()
      .split(/\s+/)[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 20) || "user"
  const suffix = Math.floor(10000 + Math.random() * 90000)
  return `${clean}_${suffix}`
}

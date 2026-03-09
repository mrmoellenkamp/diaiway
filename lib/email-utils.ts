/**
 * Erzeugt eine Test-E-Mail-Adresse aus einem Namen (für Seed/Development).
 * z.B. "Max Mustermann" → "max.mustermann@diaiway.test"
 */
export function emailForName(name: string): string {
  const local = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")
  return `${local || "expert"}@diaiway.test`
}

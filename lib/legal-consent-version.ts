/**
 * Einheitliche Versionskennung für AGB + Datenschutz zum Zeitpunkt der Registrierung.
 * Bei Dokumentenänderung erhöhen und ggf. erneute Einholung für bestehende Nutzer prüfen (Rechtsberatung).
 */
export function getLegalConsentVersion(): string {
  return (process.env.LEGAL_CONSENT_VERSION ?? "1.0").trim() || "1.0"
}

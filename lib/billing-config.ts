/**
 * Firmen-Stammdaten für Belege (Rechnungen, Gutschriften).
 * Hinterlege deine Daten in .env oder ersetze die Platzhalter.
 */
export const BILLING_SENDER = {
  name: process.env.BILLING_COMPANY_NAME ?? "JM faircharge UG",
  address: {
    street: process.env.BILLING_STREET ?? "Musterstraße 1",
    zip: process.env.BILLING_ZIP ?? "12345",
    city: process.env.BILLING_CITY ?? "Berlin",
    country: process.env.BILLING_COUNTRY ?? "Deutschland",
  },
  vatId: process.env.BILLING_VAT_ID ?? "",
  taxNumber: process.env.BILLING_TAX_NUMBER ?? "",
  bank: {
    name: process.env.BILLING_BANK_NAME ?? "",
    iban: process.env.BILLING_IBAN ?? "",
    bic: process.env.BILLING_BIC ?? "",
  },
}

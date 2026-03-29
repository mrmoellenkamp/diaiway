/**
 * Firmen-Stammdaten für Belege (Rechnungen, Gutschriften).
 * Hinterlege deine Daten in .env oder ersetze die Platzhalter.
 */
export const BILLING_SENDER = {
  name: process.env.BILLING_COMPANY_NAME ?? "JM faircharge UG",
  address: {
    street: process.env.BILLING_STREET ?? "Esmarchstraße 13",
    zip: process.env.BILLING_ZIP ?? "10407",
    city: process.env.BILLING_CITY ?? "Berlin",
    country: process.env.BILLING_COUNTRY ?? "Germany",
  },
  /** Telefon/Mobil für Rechnungskopf (optional) */
  phone: process.env.BILLING_PHONE ?? "+4917681182794",
  /** Separates Mobil (wie Vorlage: „Mobil:“ vor Bank, „Tel.:“ nach Adresswiederholung). Leer → für Mobil-Zeile wird phone genutzt. */
  mobile: process.env.BILLING_MOBILE ?? "",
  /** Kontakt-E-Mail im Rechnungskopf (optional) */
  email: process.env.BILLING_EMAIL ?? "",
  vatId: process.env.BILLING_VAT_ID ?? "DE327945253",
  taxNumber: process.env.BILLING_TAX_NUMBER ?? "37/363/50130",
  /** z. B. HRB 214163 B */
  courtRegistration: process.env.BILLING_HRB ?? "HRB 214163 B",
  /** z. B. Amtsgericht Berlin */
  registryCourt: process.env.BILLING_REGISTRY_COURT ?? "Amtsgericht Berlin",
  bank: {
    name: process.env.BILLING_BANK_NAME ?? "Landessparkasse zu Oldenburg",
    iban: process.env.BILLING_IBAN ?? "DE03280501000093194009",
    bic: process.env.BILLING_BIC ?? "SLZODE22XXX",
  },
}

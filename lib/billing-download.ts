/**
 * Utility für sichere Rechnungs- und Gutschriften-Download-Links.
 * Die API-Route /api/billing/download/[transactionId] prüft die Berechtigung
 * (Shugyo für Rechnung, Takumi für Gutschrift) vor dem Zugriff.
 */

const BASE_PATH = "/api/billing/download"

export type DownloadType = "invoice" | "credit" | "storno-invoice" | "storno-credit" | "commission"

function getBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

/**
 * Erzeugt einen sicheren Download-Link für Belege.
 * Der Zugriff erfordert Authentifizierung und Berechtigung.
 */
export function getBillingDownloadUrl(
  transactionId: string,
  type: DownloadType
): string {
  return `${getBaseUrl()}${BASE_PATH}/${transactionId}?type=${type}`
}

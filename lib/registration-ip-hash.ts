import crypto from "crypto"

/**
 * Speichert keine Klartext-IP. Für Nachweis/Abuse nur noch mit serverseitigem Pepper rekonstruierbar.
 * Retention: Hash nach interner Datenschutzfrist löschen oder anonymisieren.
 */
export function hashRegistrationIp(ip: string | null | undefined): string | null {
  if (!ip || ip === "unknown") return null
  const pepper =
    process.env.REGISTRATION_IP_PEPPER?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "dev-only-change-in-production"
  return crypto.createHash("sha256").update(`${pepper}:${ip}`, "utf8").digest("hex")
}

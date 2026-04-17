import { NextResponse } from "next/server"
import { safeBearerCompare } from "@/lib/timing-safe"
import { logSecureError } from "@/lib/log-redact"

/**
 * Zentrale, zeitkonstante Prüfung des `Authorization: Bearer <CRON_SECRET>` Headers.
 *
 * Gibt entweder eine passende NextResponse zurück (fehlende Konfiguration → 503,
 * falsches/ fehlendes Secret → 401) oder `null`, wenn die Anfrage authentifiziert ist.
 *
 * Nutzung in Cron-Routen:
 *   const err = assertCronAuthorized(req, "release-wallet")
 *   if (err) return err
 */
export function assertCronAuthorized(
  req: Request,
  context: string,
  /** zusätzliche Env-Namen, die alternativ akzeptiert werden */
  altEnvNames: string[] = []
): NextResponse | null {
  const primary = process.env.CRON_SECRET?.trim() ?? ""
  const candidates: string[] = []
  if (primary) candidates.push(primary)
  for (const name of altEnvNames) {
    const v = process.env[name]?.trim()
    if (v) candidates.push(v)
  }
  if (candidates.length === 0) {
    logSecureError(`cron.${context}`, "CRON_SECRET not configured")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  const ok = candidates.some((secret) => safeBearerCompare(authHeader, secret))
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

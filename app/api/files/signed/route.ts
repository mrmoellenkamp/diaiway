import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { verifyBlobProxyParams } from "@/lib/signed-url"
import { assertIpRateLimit } from "@/lib/api-rate-limit"
import { logSecureWarn } from "@/lib/log-redact"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/files/signed?u=...&e=...&uid=...&s=...
 *
 * Signatur-validierter Proxy zu Vercel-Blob-URLs. Der Client nutzt
 * ausschließlich diese Proxy-URL für sensible Dateien (PDFs, Ausweise,
 * Rechnungsbelege). Geleakte URLs werden nach Ablauf wertlos.
 *
 * Verhalten:
 *  - Bei uid=<userId>:  nur der eingeloggte Nutzer mit dieser id kommt durch.
 *  - Bei uid=""      :  öffentlich signiert (für Zeitraum), jede(r) mit Link.
 *  - Erfolg: 302-Redirect auf die tatsächliche Blob-URL.
 *  - Fehler: 401/403/410/429.
 */
export async function GET(req: NextRequest) {
  // Grundschutz gegen massenhaftes Ablaufen/Bruteforce:
  const rl = await assertIpRateLimit(req, {
    bucket: "files-signed",
    limit: 120,
    windowSec: 60,
  })
  if (rl) return rl

  const session = await auth()
  const currentUserId = session?.user?.id ?? null

  const verification = verifyBlobProxyParams(req.nextUrl.searchParams, {
    currentUserId,
  })
  if (!verification.ok) {
    if (verification.reason === "expired") {
      return NextResponse.json({ error: "Link abgelaufen." }, { status: 410 })
    }
    if (verification.reason === "forbidden") {
      logSecureWarn("files/signed", "forbidden access attempt", {
        requestedOwner: verification.ownerUserId ?? "",
        currentUser: currentUserId ?? "",
      })
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 })
    }
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 400 })
  }

  return NextResponse.redirect(verification.blobUrl!, { status: 302 })
}

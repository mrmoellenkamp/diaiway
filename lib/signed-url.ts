/**
 * HMAC-signierte Proxy-URLs für sensible Blobs (Dokumente, PDFs).
 *
 * Ziel: Die rohe `blob.vercel-storage.com`-URL wird clientseitig nicht mehr
 * direkt verwendet, sondern nur über `/api/files/signed?…`. Der Proxy prüft
 * Signatur + Ablauf und ggf. Eigentümerschaft, dann wird auf den Blob
 * weitergeleitet. Dadurch ist eine geleakte URL nach Ablauf wertlos.
 *
 * Apple / Google Konformität:
 *  - Google Play Data Safety: "Data is encrypted in transit"; die Daten
 *    wandern weiterhin über HTTPS, aber jetzt zusätzlich zugriffsgeschützt.
 *  - Apple App Privacy: minimiert Leak-Gefahr von sensiblen Dokumenten.
 *
 * ENV:
 *  - FILE_SIGNING_SECRET   – HMAC-Secret, Pflicht in Produktion.
 *                            Fallback in Dev: NEXTAUTH_SECRET.
 */

import crypto from "crypto"

const DEFAULT_TTL_SEC = 60 * 60 // 1 Stunde

function getSigningSecret(): string {
  const s = process.env.FILE_SIGNING_SECRET?.trim()
  if (s && s.length >= 16) return s
  const fallback = process.env.NEXTAUTH_SECRET?.trim()
  if (fallback && fallback.length >= 16) return fallback
  throw new Error("FILE_SIGNING_SECRET (or NEXTAUTH_SECRET) not configured")
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function sign(payload: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(payload).digest())
}

export interface SignUrlOptions {
  /** bindet die Signatur an einen Nutzer (nur dieser darf zugreifen). 0 = public. */
  ownerUserId?: string
  /** TTL in Sekunden (default 3600) */
  ttlSec?: number
}

/**
 * Erzeugt eine signierte Proxy-URL.
 *
 * Beispiel-Output:
 *   /api/files/signed?u=<b64urlBlobUrl>&e=<expSec>&uid=<ownerOrEmpty>&s=<hmac>
 */
export function signBlobProxyUrl(blobUrl: string, opts: SignUrlOptions = {}): string {
  const secret = getSigningSecret()
  const ttl = Math.max(30, Math.min(opts.ttlSec ?? DEFAULT_TTL_SEC, 60 * 60 * 24))
  const exp = Math.floor(Date.now() / 1000) + ttl
  const uid = opts.ownerUserId ?? ""
  const u = b64url(Buffer.from(blobUrl, "utf8"))
  const payload = `${u}.${exp}.${uid}`
  const s = sign(payload, secret)
  const qs = new URLSearchParams({ u, e: String(exp), uid, s })
  return `/api/files/signed?${qs.toString()}`
}

export interface VerifyResult {
  ok: boolean
  blobUrl?: string
  ownerUserId?: string
  reason?: "invalid" | "expired" | "forbidden"
}

/**
 * Prüft Signatur, Ablauf und (falls ownerRequirement gesetzt) Besitzer.
 */
export function verifyBlobProxyParams(
  params: URLSearchParams,
  opts: { currentUserId?: string | null } = {}
): VerifyResult {
  let secret: string
  try {
    secret = getSigningSecret()
  } catch {
    return { ok: false, reason: "invalid" }
  }

  const u = params.get("u")
  const e = params.get("e")
  const uid = params.get("uid") ?? ""
  const s = params.get("s")
  if (!u || !e || !s) return { ok: false, reason: "invalid" }

  const exp = Number.parseInt(e, 10)
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" }
  if (Math.floor(Date.now() / 1000) > exp) return { ok: false, reason: "expired" }

  const payload = `${u}.${exp}.${uid}`
  const expected = sign(payload, secret)
  try {
    const a = Buffer.from(s)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid" }
    }
  } catch {
    return { ok: false, reason: "invalid" }
  }

  if (uid && opts.currentUserId !== undefined) {
    if (uid !== opts.currentUserId) {
      return { ok: false, reason: "forbidden", ownerUserId: uid }
    }
  }

  let blobUrl: string
  try {
    blobUrl = Buffer.from(u.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  } catch {
    return { ok: false, reason: "invalid" }
  }

  // Nur Vercel-Blob-URLs als Ziel akzeptieren (verhindert Open-Redirect)
  try {
    const host = new URL(blobUrl).hostname
    if (!/\.blob\.vercel-storage\.com$/i.test(host)) {
      return { ok: false, reason: "invalid" }
    }
  } catch {
    return { ok: false, reason: "invalid" }
  }

  return { ok: true, blobUrl, ownerUserId: uid || undefined }
}

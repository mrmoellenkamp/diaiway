import { NextResponse } from "next/server"

/**
 * Erlaubte Origins für API-Aufrufe aus Capacitor / alternativen Hosts (Safari „access control checks“).
 * Ergänze in Production: CORS_ALLOWED_ORIGINS=https://a.com,https://b.com
 */
function parseAllowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []
  const defaults = [
    "https://diaiway.com",
    "https://www.diaiway.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost",
    "capacitor://localhost",
    "ionic://localhost",
    "diaiway://localhost",
    "http://localhost",
  ]
  return [...new Set([...fromEnv, ...defaults])]
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false
  const list = parseAllowedOrigins()
  if (list.includes(origin)) return true
  if (origin.endsWith(".vercel.app")) return true
  return false
}

/** Setzt CORS-Header, wenn Origin erlaubt (für credentials: 'include'). */
export function withApiCors(request: Request, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin")
  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Vary", "Origin")
  }
  return response
}

export function corsPreflightResponse(request: Request): NextResponse {
  const origin = request.headers.get("origin")
  const res = new NextResponse(null, { status: 204 })
  if (origin && isOriginAllowed(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin)
    res.headers.set("Access-Control-Allow-Credentials", "true")
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
    res.headers.set(
      "Access-Control-Allow-Headers",
      request.headers.get("access-control-request-headers") ?? "Content-Type, Authorization",
    )
    res.headers.set("Access-Control-Max-Age", "86400")
    res.headers.set("Vary", "Origin")
  }
  return res
}

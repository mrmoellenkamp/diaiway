/** Server-seitige Helfer für Site-Analytics (Beacon + Admin-Aggregation) */

export const ANALYTICS_VISITOR_STORAGE_KEY = "diaiway_analytics_vid"
export const ANALYTICS_SESSION_STORAGE_KEY = "diaiway_analytics_sid"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidAnalyticsVisitorId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id)
}

/** Nur Pfad ohne Query; Admin/API nicht tracken */
export function sanitizeAnalyticsPath(p: unknown): string | null {
  if (typeof p !== "string" || !p.startsWith("/")) return null
  const pathOnly = p.split("?")[0].split("#")[0]
  if (!pathOnly || pathOnly.length > 512) return null
  if (pathOnly.startsWith("/admin") || pathOnly.startsWith("/api")) return null
  return pathOnly
}

const BOT_UA_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternal|whatsapp|preview|lighthouse|pingdom|uptimerobot|google-inspectiontool|semrush|ahrefs/i

export function isLikelyBotUserAgent(ua: string | null): boolean {
  if (!ua) return false
  return BOT_UA_RE.test(ua)
}

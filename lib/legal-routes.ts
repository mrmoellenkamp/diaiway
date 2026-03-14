/**
 * Legal document routes for lazy-loaded content.
 * Used for Impressum, AGB, Datenschutz - content is loaded from content_{locale}.json.
 */
export const legalRoutes = [
  { path: "/legal/impressum", key: "impressum", titleKey: "footer.imprint" },
  { path: "/legal/agb", key: "agb", titleKey: "landing.terms" },
  { path: "/legal/datenschutz", key: "datenschutz", titleKey: "footer.privacy" },
] as const

export type LegalRouteKey = (typeof legalRoutes)[number]["key"]

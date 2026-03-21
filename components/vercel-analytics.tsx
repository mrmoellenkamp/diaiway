"use client"

import { Analytics } from "@vercel/analytics/next"

/** Client boundary: darf aus dem Server-Root-Layout eingebunden werden. */
export function VercelAnalytics() {
  return <Analytics />
}

"use client"

import { useTakumiPresence } from "@/hooks/use-takumi-presence"

/**
 * Löst useTakumiPresence aus, solange die App geladen ist.
 * Wird im (app)-Layout eingebunden — Takumi-Präsenz für Online-Anzeige.
 */
export function TakumiPresenceUpdater() {
  useTakumiPresence()
  return null
}

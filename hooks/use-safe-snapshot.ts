"use client"

import { useEffect, useRef, useCallback } from "react"

const DEFAULT_INTERVAL_MS = 30_000 // 30 Sekunden

export interface UseSafeSnapshotOptions {
  /** Buchungs-ID der aktiven Session (für /api/safety/snapshot) */
  bookingId: string | null
  /** Funktion, die ein Base64-Bild (data URL) liefert. Z.B. Canvas-Capture vom Video-Element. */
  getImageBase64: () => Promise<string | null>
  /** Callback bei Verstoß: Session beenden, Redirect, etc. */
  onViolation: () => void
  /** Intervall in ms (Standard: 30000) */
  intervalMs?: number
  /** Nur aktiv wenn true (z.B. phase === "IN_CALL") */
  enabled?: boolean
}

/**
 * Background-Moderation: Alle N Sekunden einen Snapshot der Kamera prüfen.
 * Nutzt /api/safety/snapshot (Vision API SafeSearch).
 * Bei Verstoß: onViolation aufrufen, User-Flag moderationViolationAt wird serverseitig gesetzt.
 */
export function useSafeSnapshot({
  bookingId,
  getImageBase64,
  onViolation,
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
}: UseSafeSnapshotOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onViolationRef = useRef(onViolation)
  onViolationRef.current = onViolation

  const captureAndSend = useCallback(async () => {
    if (!bookingId) return

    try {
      const dataUrl = await getImageBase64()
      if (!dataUrl || typeof dataUrl !== "string") return

      const res = await fetch("/api/safety/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, imageBase64: dataUrl }),
      })
      const data = await res.json().catch(() => null)

      if (data?.incidentCreated) {
        console.warn("[useSafeSnapshot] Verstoß erkannt – Session wird beendet.")
        onViolationRef.current()
      }
    } catch (e) {
      console.warn("[useSafeSnapshot] Snapshot senden:", e)
    }
  }, [bookingId, getImageBase64])

  useEffect(() => {
    if (!enabled || !bookingId) return

    const id = setInterval(captureAndSend, intervalMs)
    intervalRef.current = id

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, bookingId, intervalMs, captureAndSend])
}

"use client"

/**
 * Daily Prebuilt — fertiges Video-UI von Daily, oft zuverlässiger als Custom.
 * Verwendet createFrame() für ein eingebettetes iframe.
 * Kamera-Wechsel (Front/Rück) via customTrayButtons + cycleCamera() für Mobilgeräte.
 */

import { useEffect, useRef } from "react"

export interface DailyPrebuiltCallProps {
  roomUrl: string
  isCameraOff?: boolean
  isMuted?: boolean
  otherParticipantName?: string
  otherParticipantInitials?: string
}

/** Alias for VideoConfig compatibility */
export type DailyVideoCallProps = DailyPrebuiltCallProps

/** diaiway Primärfarbe (accent aus globals.css) */
const ACCENT_HEX = "#22c55e"

/** Kamera-Wechsel Icon (Data-URL) — zuverlässig ohne CORS-Probleme */
const CAMERA_SWITCH_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTEgMTlINGEyIDIgMCAwIDEtMi0yVjdhMiAyIDAgMCAxIDItMmg1Ii8+PHBhdGggZD0iTTEzIDVoN2EyIDIgMCAwIDEgMiAydjEwYTIgMiAwIDAgMS0yIDJoLTUiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PHBhdGggZD0ibTE4IDIyLTMtMyAzLTMiLz48cGF0aCBkPSJtNiAyIDMgMy0zIDMiLz48L3N2Zz4="

export default function DailyPrebuiltCall({
  roomUrl,
}: DailyPrebuiltCallProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return

    let frame: { destroy: () => void; on: (e: string, h: (ev: { button_id: string }) => void) => void; cycleCamera: (opts: { preferDifferentFacingMode: boolean }) => Promise<unknown> } | null = null

    async function init() {
      const Daily = (await import("@daily-co/daily-js")).default

      frame = Daily.createFrame(containerRef.current!, {
        url: roomUrl,
        lang: "de",
        theme: { colors: { accent: ACCENT_HEX } },
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "0",
        },
        showLeaveButton: false, // Wir nutzen eigene End-Call-Steuerung
        customTrayButtons: {
          cameraSwitch: {
            iconPath: CAMERA_SWITCH_ICON,
            iconPathDarkMode: CAMERA_SWITCH_ICON,
            label: "Kamera wechseln",
            tooltip: "Front- und Rückkamera wechseln (falls verfügbar)",
          },
        },
      }) as typeof frame

      frame.on("custom-button-click", (ev: { button_id: string }) => {
        if (ev.button_id === "cameraSwitch") {
          frame?.cycleCamera?.({ preferDifferentFacingMode: true }).catch((err) =>
            console.warn("[Daily] Kamera-Wechsel:", err)
          )
        }
      })

      await frame.join()
    }

    init().catch((err) => console.error("[Daily Prebuilt] Join failed:", err))

    return () => {
      if (frame && typeof frame.destroy === "function") {
        frame.destroy()
      }
    }
  }, [roomUrl])

  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0"
      style={{
        minHeight: "400px",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    />
  )
}

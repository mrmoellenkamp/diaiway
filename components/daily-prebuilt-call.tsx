"use client"

/**
 * Daily Prebuilt — fertiges Video-UI von Daily, oft zuverlässiger als Custom.
 * Verwendet createFrame() für ein eingebettetes iframe.
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

export default function DailyPrebuiltCall({
  roomUrl,
}: DailyPrebuiltCallProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return

    let frame: { destroy: () => void } | null = null

    async function init() {
      const Daily = (await import("@daily-co/daily-js")).default
      frame = Daily.createFrame(containerRef.current!, {
        url: roomUrl,
        lang: "de",
        theme: { accent: ACCENT_HEX },
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "0",
        },
        showLeaveButton: false, // Wir nutzen eigene End-Call-Steuerung
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

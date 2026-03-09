"use client"

/**
 * AudioCallInterface — Voice-Only Call mit Daily Prebuilt (createFrame).
 * Nutzt createFrame wie Video, aber mit videoSource: false für Audio-only.
 * Beide Teilnehmer verbinden zuverlässig über dieselbe Daily-Raum-URL.
 */

import { useEffect, useRef } from "react"

export interface AudioCallInterfaceProps {
  roomUrl: string
  isMuted?: boolean
  otherParticipantName: string
  otherParticipantInitials: string
}

const ACCENT_HEX = "#22c55e"

export default function AudioCallInterface({
  roomUrl,
  isMuted = false,
  otherParticipantName,
  otherParticipantInitials,
}: AudioCallInterfaceProps) {
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
        startVideoOff: true, // Audio-only: Kamera aus (videoSource wird von Prebuilt ignoriert)
        showLeaveButton: false,
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "0",
        },
      }) as typeof frame

      await frame.join()
    }

    init().catch((err) => console.error("[Daily Audio] Join failed:", err))

    return () => {
      if (frame && typeof (frame as { destroy?: () => void }).destroy === "function") {
        ;(frame as { destroy: () => void }).destroy()
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

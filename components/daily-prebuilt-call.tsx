"use client"

/**
 * Daily Prebuilt — Video-Call mit Daily createFrame.
 * Fehlerbehandlung, Retry, Kamera-Wechsel (Front/Rück) via customTrayButtons.
 */

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { AlertTriangle, Loader2 } from "lucide-react"

export interface DailyPrebuiltCallProps {
  roomUrl: string
  isCameraOff?: boolean
  isMuted?: boolean
  otherParticipantName?: string
  otherParticipantInitials?: string
  onJoinError?: (err: Error) => void
  onJoinSuccess?: () => void
  onRetry?: () => void
}

/** Alias for VideoConfig compatibility */
export type DailyVideoCallProps = DailyPrebuiltCallProps

const ACCENT_HEX = "#22c55e"

const CAMERA_SWITCH_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTEgMTlINGEyIDIgMCAwIDEtMi0yVjdhMiAyIDAgMCAxIDItMmg1Ii8+PHBhdGggZD0iTTEzIDVoN2EyIDIgMCAwIDEgMiAydjEwYTIgMiAwIDAgMS0yIDJoLTUiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PHBhdGggZD0ibTE4IDIyLTMtMyAzLTMiLz48cGF0aCBkPSJtNiAyIDMgMy0zIDMiLz48L3N2Zz4="

export default function DailyPrebuiltCall({
  roomUrl,
  onJoinError,
  onJoinSuccess,
  onRetry,
}: DailyPrebuiltCallProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [joinError, setJoinError] = useState<Error | null>(null)
  const [isJoining, setIsJoining] = useState(true)

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return

    setJoinError(null)
    setIsJoining(true)
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
        showLeaveButton: false,
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

      try {
        await frame.join()
        setIsJoining(false)
        onJoinSuccess?.()
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        if (frame && typeof frame.destroy === "function") {
          frame.destroy()
          frame = null
        }
        setJoinError(error)
        setIsJoining(false)
        onJoinError?.(error)
        console.error("[Daily Prebuilt] Join failed:", err)
      }
    }

    init()
    return () => {
      if (frame && typeof frame.destroy === "function") {
        frame.destroy()
      }
    }
  }, [roomUrl, onJoinError, onJoinSuccess])

  // Container muss immer gemountet sein, damit createFrame ein Ziel hat
  const container = (
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

  if (joinError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary to-emerald-800 p-6">
        <AlertTriangle className="size-12 text-primary-foreground/90" />
        <p className="text-center text-sm text-primary-foreground/90">{t("video.joinFailed")}</p>
        <p className="text-center text-xs text-primary-foreground/60">
          {joinError.message}
        </p>
        <Button
          variant="secondary"
          className="bg-white/20 text-primary-foreground hover:bg-white/30"
          onClick={() => (onRetry ? onRetry() : window.location.reload())}
        >
          {t("video.retryJoin")}
        </Button>
      </div>
    )
  }

  // Beim Joinen: Loading-Overlay über dem Container (Daily-iframe lädt)
  if (isJoining) {
    return (
      <div className="relative flex flex-1 flex-col">
        {container}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/95 to-emerald-800/95">
          <Loader2 className="size-10 animate-spin text-primary-foreground" />
          <p className="mt-3 text-sm text-primary-foreground">{t("video.roomPreparing")}</p>
        </div>
      </div>
    )
  }

  return container
}

"use client"

/**
 * CallEngine — Einheitliche Video- und Voice-Call-Engine.
 * Nutzt Daily Prebuilt (createFrame) mit direktem Join (enable_prejoin_ui: false).
 * Unser Precheck in der Lobby ersetzt Daily-Prejoin → zuverlässige Verbindung.
 */

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { AlertTriangle, Loader2 } from "lucide-react"

const ACCENT_HEX = "#22c55e"
const JOIN_TIMEOUT_MS = 30000

const CAMERA_SWITCH_ICON =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTEgMTlINGEyIDIgMCAwIDEtMi0yVjdhMiAyIDAgMCAxIDItMmg1Ii8+PHBhdGggZD0iTTEzIDVoN2EyIDIgMCAwIDEgMiAydjEwYTIgMiAwIDAgMS0yIDJoLTUiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIi8+PHBhdGggZD0ibTE4IDIyLTMtMyAzLTMiLz48cGF0aCBkPSJtNiAyIDMgMy0zIDMiLz48L3N2Zz4="

export interface CallEngineProps {
  roomUrl: string
  mode: "video" | "voice"
  onRetry?: () => void
}

export default function CallEngine({ roomUrl, mode, onRetry }: CallEngineProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"joining" | "joined" | "error">("joining")
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return

    setStatus("joining")
    setError(null)
    let frame: {
      destroy: () => void
      on: (e: string, h: (ev?: unknown) => void) => void
      join: () => Promise<unknown>
      cycleCamera?: (opts: { preferDifferentFacingMode: boolean }) => Promise<unknown>
    } | null = null
    let failed = false

    function fail(err: Error) {
      if (failed) return
      failed = true
      frame?.destroy?.()
      frame = null
      setError(err)
      setStatus("error")
      console.error("[CallEngine] Join failed:", err)
    }

    async function init() {
      const Daily = (await import("@daily-co/daily-js")).default

      frame = Daily.createFrame(containerRef.current!, {
        url: roomUrl,
        lang: "de",
        theme: { colors: { accent: ACCENT_HEX } },
        showLeaveButton: false,
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "0",
        },
        ...(mode === "voice"
          ? { startVideoOff: true }
          : {
              customTrayButtons: {
                cameraSwitch: {
                  iconPath: CAMERA_SWITCH_ICON,
                  iconPathDarkMode: CAMERA_SWITCH_ICON,
                  label: "Kamera wechseln",
                  tooltip: "Front- und Rückkamera wechseln",
                },
              },
            }),
      }) as typeof frame

      frame.on("error", (ev?: { errorMsg?: string }) => {
        fail(new Error(ev?.errorMsg ?? "Verbindungsfehler"))
      })
      frame.on("load-attempt-failed", (ev?: { errorMsg?: string }) => {
        console.warn("[CallEngine] load-attempt-failed:", ev?.errorMsg)
      })

      if (mode === "video" && frame.cycleCamera) {
        frame.on("custom-button-click", (ev: { button_id?: string }) => {
          if (ev.button_id === "cameraSwitch") {
            frame?.cycleCamera?.({ preferDifferentFacingMode: true }).catch((e) =>
              console.warn("[CallEngine] Kamera-Wechsel:", e)
            )
          }
        })
      }

      try {
        const timeout = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("join-timeout")), JOIN_TIMEOUT_MS)
        )
        await Promise.race([frame.join(), timeout])
        if (!failed) setStatus("joined")
      } catch (err) {
        if (!failed) fail(err instanceof Error ? err : new Error(String(err)))
      }
    }

    init()
    return () => frame?.destroy?.()
  }, [roomUrl, mode])

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

  if (status === "error" && error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary to-emerald-800 p-6">
        <AlertTriangle className="size-12 text-primary-foreground/90" />
        <p className="text-center text-sm text-primary-foreground/90">{t("video.joinFailed")}</p>
        <p className="text-center text-xs text-primary-foreground/60">
          {error.message === "join-timeout" ? t("video.joinTimeout") : error.message}
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

  if (status === "joining") {
    return (
      <div className="relative flex flex-1 flex-col">
        {container}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/90 to-emerald-800/90">
          <Loader2 className="size-10 animate-spin text-primary-foreground" />
          <p className="mt-3 text-sm text-primary-foreground">{t("video.roomPreparing")}</p>
        </div>
      </div>
    )
  }

  return container
}

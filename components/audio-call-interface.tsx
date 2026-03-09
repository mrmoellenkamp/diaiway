"use client"

/**
 * AudioCallInterface — Voice-Only Call mit Daily Prebuilt (createFrame).
 * Theme wie Video, Fehlerbehandlung + Retry.
 */

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { AlertTriangle, Loader2 } from "lucide-react"

export interface AudioCallInterfaceProps {
  roomUrl: string
  isMuted?: boolean
  otherParticipantName: string
  otherParticipantInitials: string
  onJoinError?: (err: Error) => void
  onJoinSuccess?: () => void
  onRetry?: () => void
}

const ACCENT_HEX = "#22c55e"

export default function AudioCallInterface({
  roomUrl,
  onJoinError,
  onJoinSuccess,
  onRetry,
}: AudioCallInterfaceProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [joinError, setJoinError] = useState<Error | null>(null)
  const [isJoining, setIsJoining] = useState(true)

  const JOIN_TIMEOUT_MS = 45000

  useEffect(() => {
    if (!roomUrl || !containerRef.current) return

    setJoinError(null)
    setIsJoining(true)
    let frame: { destroy: () => void; on: (e: string, h: (ev?: unknown) => void) => void; join: () => Promise<unknown> } | null = null
    let joinFailed = false

    function failJoin(err: Error) {
      if (joinFailed) return
      joinFailed = true
      if (frame && typeof frame.destroy === "function") {
        frame.destroy()
        frame = null
      }
      setJoinError(err)
      setIsJoining(false)
      onJoinError?.(err)
      console.error("[Daily Audio] Join failed:", err)
    }

    async function init() {
      const Daily = (await import("@daily-co/daily-js")).default
      frame = Daily.createFrame(containerRef.current!, {
        url: roomUrl,
        lang: "de",
        theme: { colors: { accent: ACCENT_HEX } },
        startVideoOff: true,
        showLeaveButton: false,
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "none",
          borderRadius: "0",
        },
      }) as typeof frame

      frame.on("error", (ev?: { errorMsg?: string }) => {
        failJoin(new Error(ev?.errorMsg ?? "Verbindungsfehler"))
      })
      frame.on("load-attempt-failed", (ev?: { errorMsg?: string }) => {
        console.warn("[Daily Audio] load-attempt-failed:", ev?.errorMsg)
      })

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("join-timeout")), JOIN_TIMEOUT_MS)
        )
        await Promise.race([frame.join(), timeoutPromise])
        if (!joinFailed) {
          setIsJoining(false)
          onJoinSuccess?.()
        }
      } catch (err) {
        if (!joinFailed) {
          const msg = err instanceof Error ? err : new Error(String(err))
          failJoin(msg)
        }
      }
    }

    init()
    return () => {
      if (frame && typeof (frame as { destroy?: () => void }).destroy === "function") {
        ;(frame as { destroy: () => void }).destroy()
      }
    }
  }, [roomUrl, onJoinError, onJoinSuccess])

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
          {joinError.message === "join-timeout" ? t("video.joinTimeout") : joinError.message}
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

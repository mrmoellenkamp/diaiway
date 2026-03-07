"use client"

/**
 * This module is loaded exclusively client-side via next/dynamic + ssr:false.
 * All @daily-co/* imports live here so Next.js never attempts to SSR them,
 * preventing the "window is not defined" build error on Vercel.
 */

import { useEffect } from "react"
import {
  DailyProvider,
  useDaily,
  useParticipantIds,
  useVideoTrack,
  useAudioTrack,
  DailyVideo,
} from "@daily-co/daily-react"
import { User, VideoOff } from "lucide-react"

// ─── Tile ──────────────────────────────────────────────────────────────────

function DailyVideoTile({
  sessionId,
  isLocal,
}: {
  sessionId: string
  isLocal?: boolean
}) {
  const videoTrack = useVideoTrack(sessionId)
  const audioTrack = useAudioTrack(sessionId)

  return (
    <div className={`relative overflow-hidden ${isLocal ? "size-32 rounded-2xl" : "size-full"}`}>
      {videoTrack?.state === "playable" ? (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          className="size-full object-cover"
          mirror={isLocal}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-stone-800">
          <User className="size-12 text-primary-foreground/30" />
        </div>
      )}
      {!isLocal && audioTrack?.state === "playable" && (
        <DailyVideo sessionId={sessionId} type="audio" />
      )}
    </div>
  )
}

// ─── Remote participants ────────────────────────────────────────────────────

function RemoteParticipants({
  otherParticipantName,
  otherParticipantInitials,
}: {
  otherParticipantName: string
  otherParticipantInitials: string
}) {
  const participantIds = useParticipantIds({ filter: "remote" })

  if (participantIds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-28 items-center justify-center rounded-full border-4 border-white/20 bg-white/10">
          <span className="text-3xl font-bold text-primary-foreground">{otherParticipantInitials}</span>
        </div>
        <p className="text-lg font-semibold text-primary-foreground">{otherParticipantName}</p>
        <p className="text-sm text-primary-foreground/60">Warte auf Verbindung...</p>
      </div>
    )
  }

  return (
    <>
      {participantIds.map((id) => (
        <DailyVideoTile key={id} sessionId={id} />
      ))}
    </>
  )
}

// ─── Error handler (logs Daily errors to console for debugging) ─────────────

function DailyErrorHandler() {
  const daily = useDaily()
  useEffect(() => {
    const call = daily
    if (!call) return
    const handleError = (e: { type?: string; errorMsg?: string }) => {
      console.error("[Daily] Error:", e?.type, e?.errorMsg ?? e)
    }
    call.on("error", handleError)
    call.on("nonfatal-error", handleError)
    return () => {
      call.off("error", handleError)
      call.off("nonfatal-error", handleError)
    }
  }, [daily])
  return null
}

// ─── Local participant (PiP) ────────────────────────────────────────────────

function LocalParticipant({ isCameraOff }: { isCameraOff: boolean }) {
  const daily = useDaily()
  const localSessionId = daily?.participants()?.local?.session_id

  if (!localSessionId) {
    return (
      <div className="flex size-full items-center justify-center bg-stone-800">
        {isCameraOff ? (
          <VideoOff className="size-8 text-primary-foreground/40" />
        ) : (
          <User className="size-12 text-primary-foreground/30" />
        )}
      </div>
    )
  }

  return <DailyVideoTile sessionId={localSessionId} isLocal />
}

// ─── Public export ─────────────────────────────────────────────────────────

export interface DailyVideoCallProps {
  roomUrl: string
  isCameraOff: boolean
  isMuted?: boolean
  /** Name of the other participant we're waiting for (Shugyo or Takumi depending on viewer) */
  otherParticipantName: string
  /** Initials for the other participant's avatar */
  otherParticipantInitials: string
}

// eslint-disable-next-line react/display-name
export default function DailyVideoCall({
  roomUrl,
  isCameraOff,
  isMuted = false,
  otherParticipantName,
  otherParticipantInitials,
}: DailyVideoCallProps) {
  const dailyConfig = {
    startVideoOff: isCameraOff,
    startAudioOff: isMuted,
  }
  return (
    <DailyProvider url={roomUrl} dailyConfig={dailyConfig}>
      <DailyErrorHandler />
      {/* Remote video — full screen */}
      <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
        <RemoteParticipants
          otherParticipantName={otherParticipantName}
          otherParticipantInitials={otherParticipantInitials}
        />
      </div>

      {/* Self-view PiP */}
      <div className="absolute right-4 top-16 flex size-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 shadow-lg">
        <LocalParticipant isCameraOff={isCameraOff} />
      </div>
    </DailyProvider>
  )
}

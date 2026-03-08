"use client"

/**
 * AudioCallInterface — Voice-Only Call UI mit Daily.
 * Zeigt Avatar des Gegenübers + pulsierenden Voice-Visualizer (audioLevel).
 */

import { useEffect, useState } from "react"
import {
  DailyProvider,
  useDaily,
  useParticipantIds,
  useAudioLevelObserver,
} from "@daily-co/daily-react"
import { User } from "lucide-react"

function VoiceVisualizer({ sessionId }: { sessionId: string }) {
  const [level, setLevel] = useState(0)
  useAudioLevelObserver(sessionId, { onVolumeChange: (v) => setLevel(Math.min(1, v / 255)) })

  const bars = 12
  const heights = Array.from({ length: bars }, (_, i) => {
    const center = bars / 2
    const dist = Math.abs(i - center) / center
    const factor = 1 - dist * 0.5
    return Math.max(4, Math.round(20 + level * 40 * factor))
  })

  return (
    <div className="flex items-end justify-center gap-0.5 h-16">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-primary-foreground/60 transition-all duration-100"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}

function VoiceCallContent({
  otherParticipantName,
  otherParticipantInitials,
}: {
  otherParticipantName: string
  otherParticipantInitials: string
}) {
  const daily = useDaily()
  const remoteIds = useParticipantIds({ filter: "remote" })
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (remoteIds.length > 0) setActiveSessionId(remoteIds[0])
  }, [remoteIds])

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-primary to-emerald-800 px-4">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex size-40 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 shadow-xl">
          <span className="text-5xl font-bold text-primary-foreground">
            {otherParticipantInitials}
          </span>
          {activeSessionId && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <VoiceVisualizer sessionId={activeSessionId} />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-primary-foreground">{otherParticipantName}</p>
          <p className="text-sm text-primary-foreground/70">
            {remoteIds.length > 0 ? "Voice Call verbunden" : "Warte auf Verbindung…"}
          </p>
        </div>
      </div>
    </div>
  )
}

function DailyAudioErrorHandler() {
  const daily = useDaily()
  useEffect(() => {
    if (!daily) return
    const handleError = (e: { type?: string; errorMsg?: string }) => {
      console.error("[Daily Audio] Error:", e?.type, e?.errorMsg ?? e)
    }
    daily.on("error", handleError)
    daily.on("nonfatal-error", handleError)
    return () => {
      daily.off("error", handleError)
      daily.off("nonfatal-error", handleError)
    }
  }, [daily])
  return null
}

export interface AudioCallInterfaceProps {
  roomUrl: string
  isMuted?: boolean
  otherParticipantName: string
  otherParticipantInitials: string
}

export default function AudioCallInterface({
  roomUrl,
  isMuted = false,
  otherParticipantName,
  otherParticipantInitials,
}: AudioCallInterfaceProps) {
  const dailyConfig = {
    videoSource: false,
    startVideoOff: true,
    startAudioOff: isMuted,
  }

  return (
    <DailyProvider url={roomUrl} dailyConfig={dailyConfig}>
      <DailyAudioErrorHandler />
      <div className="relative flex flex-1 flex-col min-h-0">
        <VoiceCallContent
          otherParticipantName={otherParticipantName}
          otherParticipantInitials={otherParticipantInitials}
        />
      </div>
    </DailyProvider>
  )
}

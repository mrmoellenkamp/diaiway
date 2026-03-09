"use client"

/**
 * DailyCallBlock — Lobby-Architektur mit startCamera vor join().
 * Nur @daily-co/daily-js, CallObject-Modell.
 * Kamera-Vorschau in Lobby, Timer startet erst bei joined-meeting.
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { Mic, MicOff, Video, VideoOff, PhoneOff, SwitchCamera, Flag, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useI18n } from "@/lib/i18n"

type CallMode = "voice" | "video"

interface DailyCallBlockProps {
  roomUrl: string
  callMode: CallMode
  takumiName: string
  onJoined: () => void
  onLeave: () => void
  onReportAndLeave: () => void
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

export function DailyCallBlock({
  roomUrl,
  callMode,
  takumiName,
  onJoined,
  onLeave,
  onReportAndLeave,
}: DailyCallBlockProps) {
  const { t } = useI18n()
  const callObjectRef = useRef<ReturnType<typeof import("@daily-co/daily-js").createCallObject> | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const mountedRef = useRef(true)

  const [error, setError] = useState<Error | null>(null)
  const [isLobbyReady, setIsLobbyReady] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(callMode === "video")
  const [isPartnerSpeaking, setIsPartnerSpeaking] = useState(false)
  const [localTrack, setLocalTrack] = useState<MediaStreamTrack | null>(null)
  const [remoteTrack, setRemoteTrack] = useState<MediaStreamTrack | null>(null)

  const bindTrackToRef = useCallback((ref: React.RefObject<HTMLVideoElement | null>, track: MediaStreamTrack | null) => {
    if (!ref.current) return
    if (track) {
      const stream = new MediaStream([track])
      ref.current.srcObject = stream
    } else {
      ref.current.srcObject = null
    }
  }, [])

  const updateTracks = useCallback(() => {
    const call = callObjectRef.current
    if (!call || !mountedRef.current) return
    const parts = call.participants()
    const local = parts?.local
    const lt = (local?.tracks?.video as { persistentTrack?: MediaStreamTrack } | undefined)?.persistentTrack ?? null
    const remote = Object.entries(parts ?? {}).find(([_, p]) => !(p as { local?: boolean }).local)?.[1] as
      | { tracks?: { video?: { persistentTrack?: MediaStreamTrack } } }
      | undefined
    const rt = remote?.tracks?.video?.persistentTrack ?? null
    setLocalTrack(lt)
    setRemoteTrack(rt)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const call = callObjectRef.current
      if (call) {
        call.destroy()
        callObjectRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (localVideoRef.current && localTrack) bindTrackToRef(localVideoRef, localTrack)
    return () => {
      if (localVideoRef.current) localVideoRef.current.srcObject = null
    }
  }, [localTrack, bindTrackToRef])

  useEffect(() => {
    if (remoteVideoRef.current && remoteTrack) bindTrackToRef(remoteVideoRef, remoteTrack)
    return () => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    }
  }, [remoteTrack, bindTrackToRef])

  useEffect(() => {
    if (!roomUrl) return
    let call: ReturnType<typeof import("@daily-co/daily-js").createCallObject> | null = null

    async function init() {
      setError(null)
      let Daily: typeof import("@daily-co/daily-js").default
      try {
        Daily = (await import("@daily-co/daily-js")).default
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Daily nicht geladen"))
        return
      }

      call = Daily.createCallObject({
        url: roomUrl,
        subscribeToTracksAutomatically: true,
        allowMultipleCallInstances: true,
        ...(callMode === "voice" ? { videoSource: false } : {}),
      })
      callObjectRef.current = call

      const onTrackUpdate = () => {
        if (!mountedRef.current) return
        updateTracks()
      }

      call.on("participant-updated", onTrackUpdate)
      call.on("track-started", onTrackUpdate)
      call.on("track-stopped", onTrackUpdate)

      call.on("joined-meeting", () => {
        if (!mountedRef.current) return
        setIsJoined(true)
        onJoined()
        const parts = call!.participants()
        const local = parts?.local
        if (local?.tracks?.video?.state === "playable") setIsVideoOn(true)
        else if (callMode === "video") setIsVideoOn(false)
        updateTracks()
      })

      call.on("left-meeting", () => {
        if (!mountedRef.current) return
        setIsJoined(false)
        setLocalTrack(null)
        setRemoteTrack(null)
      })

      call.on("active-speaker-change", (ev: { activeSpeaker?: { peerId?: string } }) => {
        if (!mountedRef.current) return
        const localId = call!.participants()?.local?.session_id
        setIsPartnerSpeaking(!!ev.activeSpeaker?.peerId && ev.activeSpeaker.peerId !== localId)
      })

      call.on("remote-participants-audio-level", (ev: { participants?: Record<string, { level?: number }> }) => {
        if (!mountedRef.current) return
        const levels = ev.participants ?? {}
        setIsPartnerSpeaking(Object.values(levels).some((p) => (p?.level ?? 0) > 0.02))
      })

      call.on("error", (ev: { errorMsg?: string }) => {
        if (!mountedRef.current) return
        setError(new Error(ev?.errorMsg ?? "Verbindungsfehler"))
      })

      call.on("camera-error", () => {
        if (!mountedRef.current) return
        setError(new Error("Kamera-Fehler"))
      })

      call.on("started-camera", () => {
        if (!mountedRef.current) return
        updateTracks()
      })

      try {
        if (callMode === "video") {
          await call.startCamera({ url: roomUrl })
          if (!mountedRef.current) return
          setIsLobbyReady(true)
          updateTracks()
        } else {
          await call.startCamera({ url: roomUrl, videoSource: false })
          if (!mountedRef.current) return
          setIsLobbyReady(true)
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    init()
    return () => {
      if (call) {
        call.destroy()
        callObjectRef.current = null
      }
    }
  }, [roomUrl, callMode, onJoined, updateTracks])

  const handleJoin = useCallback(async () => {
    const call = callObjectRef.current
    if (!call || !isLobbyReady || isJoined) return
    try {
      setError(null)
      await call.join()
      call.startRemoteParticipantsAudioLevelObserver(200)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [isLobbyReady, isJoined])

  const handleLeave = useCallback(async () => {
    const call = callObjectRef.current
    if (call) {
      try {
        await call.leave()
      } finally {
        call.destroy()
        callObjectRef.current = null
        onLeave()
      }
    } else {
      onLeave()
    }
  }, [onLeave])

  const cycleCamera = useCallback(async () => {
    const call = callObjectRef.current
    if (!call || !isJoined || callMode !== "video") return
    try {
      await call.cycleCamera({ preferDifferentFacingMode: true })
      updateTracks()
    } catch (err) {
      console.warn("[DailyCallBlock] cycleCamera:", err)
    }
  }, [isJoined, callMode, updateTracks])

  const toggleMute = useCallback(() => {
    const call = callObjectRef.current
    if (!call || !isJoined) return
    const next = !isMuted
    call.setLocalAudio(next)
    setIsMuted(!next)
  }, [isJoined, isMuted])

  const toggleVideo = useCallback(() => {
    const call = callObjectRef.current
    if (!call || !isJoined || callMode !== "video") return
    const next = !isVideoOn
    call.setLocalVideo(next)
    setIsVideoOn(next)
  }, [isJoined, isVideoOn, callMode])

  const initials = getInitials(takumiName)

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary to-emerald-800 p-6">
        <p className="text-center text-sm font-medium text-primary-foreground">{error.message}</p>
        <button
          onClick={handleJoin}
          className="min-h-[48px] min-w-[48px] rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-white/30"
        >
          {t("video.retryJoin")}
        </button>
      </div>
    )
  }

  if (!isLobbyReady) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary to-emerald-800 p-6">
        <Loader2 className="size-10 animate-spin text-primary-foreground" />
        <p className="text-center text-sm font-medium text-primary-foreground">
          {callMode === "video" ? t("video.prejoinHint") : t("video.roomPreparing")}
        </p>
      </div>
    )
  }

  if (!isJoined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary to-emerald-800 p-6">
        {callMode === "video" && localTrack ? (
          <div className="aspect-video w-full max-w-sm overflow-hidden rounded-xl border-2 border-white/30 bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <Avatar className="size-24 border-4 border-white/30">
            <AvatarFallback className="bg-white/20 text-2xl font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
        <p className="text-center text-sm text-primary-foreground/90">{takumiName}</p>
        <button
          onClick={handleJoin}
          className="min-h-[48px] min-w-[48px] rounded-xl bg-accent px-8 py-3 text-base font-bold text-accent-foreground shadow-lg hover:bg-accent/90"
        >
          {t("video.join")}
        </button>
      </div>
    )
  }

  if (callMode === "voice") {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-primary to-emerald-800 p-6">
        <div
          className={`relative flex size-40 items-center justify-center rounded-full transition-all duration-300 ${
            isPartnerSpeaking
              ? "animate-[pulse_1.2s_ease-in-out_infinite] ring-4 ring-accent/60"
              : "ring-2 ring-white/20"
          }`}
        >
          <Avatar className="size-36 border-4 border-white/30">
            <AvatarFallback className="bg-white/20 text-3xl font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
        <p className="mt-4 text-lg font-semibold text-primary-foreground">{takumiName}</p>
        {isPartnerSpeaking && (
          <p className="mt-1 text-xs text-primary-foreground/80">{t("video.partnerSpeaking")}</p>
        )}
        <CallControls
          isVoice
          isMuted={isMuted}
          isVideoOn={isVideoOn}
          onMute={toggleMute}
          onVideo={toggleVideo}
          onFlip={() => {}}
          onLeave={handleLeave}
          onReport={onReportAndLeave}
          t={t}
        />
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-foreground">
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-emerald-900/20">
        {remoteTrack ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Avatar className="size-28 border-4 border-white/20">
              <AvatarFallback className="bg-primary/20 text-2xl font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium text-primary-foreground/80">{takumiName}</p>
            <p className="text-xs text-primary-foreground/60">{t("video.waitingForVideo")}</p>
          </div>
        )}
      </div>
      <div className="absolute right-4 top-20 z-10 aspect-video w-24 overflow-hidden rounded-xl border-2 border-white/30 bg-black shadow-xl">
        {localTrack && isVideoOn ? (
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/30">
            <VideoOff className="size-6 text-primary-foreground/60" />
          </div>
        )}
      </div>
      <CallControls
        isVoice={false}
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        onMute={toggleMute}
        onVideo={toggleVideo}
        onFlip={cycleCamera}
        onLeave={handleLeave}
        onReport={onReportAndLeave}
        t={t}
      />
    </div>
  )
}

function CallControls({
  isVoice,
  isMuted,
  isVideoOn,
  onMute,
  onVideo,
  onFlip,
  onLeave,
  onReport,
  t,
}: {
  isVoice: boolean
  isMuted: boolean
  isVideoOn: boolean
  onMute: () => void
  onVideo: () => void
  onFlip: () => void
  onLeave: () => void
  onReport: () => void
  t: (key: string) => string
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pb-8 pt-12">
      <div className="mx-auto flex max-w-xs items-center justify-around">
        <button
          onClick={onMute}
          className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full transition-colors sm:size-14 ${
            isMuted ? "bg-destructive" : "bg-white/20"
          }`}
          aria-label={isMuted ? t("video.unmuteAria") : t("video.muteAria")}
        >
          {isMuted ? <MicOff className="size-6 text-destructive-foreground" /> : <Mic className="size-6 text-primary-foreground" />}
        </button>
        {!isVoice && (
          <>
            <button
              onClick={onVideo}
              className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full transition-colors sm:size-14 ${
                !isVideoOn ? "bg-destructive" : "bg-white/20"
              }`}
              aria-label={isVideoOn ? t("video.camOff") : t("video.camOn")}
            >
              {isVideoOn ? <Video className="size-6 text-primary-foreground" /> : <VideoOff className="size-6 text-destructive-foreground" />}
            </button>
            <button
              onClick={onFlip}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 sm:size-14"
              aria-label={t("video.flipCamera")}
            >
              <SwitchCamera className="size-6 text-primary-foreground" />
            </button>
          </>
        )}
        <button
          onClick={onLeave}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-destructive shadow-lg transition-transform active:scale-95 sm:size-16"
          aria-label={t("video.endCall")}
        >
          <PhoneOff className="size-7 text-destructive-foreground" />
        </button>
        <button
          onClick={onReport}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 sm:size-14"
          aria-label={t("safety.reportAndLeave")}
          title={t("safety.reportAndLeaveDesc")}
        >
          <Flag className="size-6 text-primary-foreground" />
        </button>
      </div>
    </div>
  )
}

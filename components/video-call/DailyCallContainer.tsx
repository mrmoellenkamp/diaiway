"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Daily from "@daily-co/daily-js"
import type { DailyCall } from "@daily-co/daily-js"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { FlipHorizontal, Mic, MicOff, PhoneOff } from "lucide-react"

// --- State Machine ---
type CallPhase = "LOBBY" | "JOINING" | "IN_CALL"

type CallMode = "video" | "voice"
type UserRole = "shugyo" | "takumi"

interface DailyCallContainerProps {
  bookingId: string
  callMode: CallMode
  userRole: UserRole
  /** Profilbild-URL des Partners (für Voice-Mode Adaptive UI) */
  partnerImageUrl?: string | null
  partnerName?: string
}

interface MediaDevice {
  deviceId: string
  label: string
  kind: "videoinput" | "audioinput"
}

const TIMER_DURATION_SEC = 5 * 60 // 5 Minuten
const AUDIO_LEVEL_SPEAKING_THRESHOLD = 0.02

export function DailyCallContainer({
  bookingId,
  callMode,
  userRole,
  partnerImageUrl,
  partnerName = "Partner",
}: DailyCallContainerProps) {
  // State Machine
  const [phase, setPhase] = useState<CallPhase>("LOBBY")
  const [error, setError] = useState<string | null>(null)

  // Lobby: Lokale Vorschau
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const [devices, setDevices] = useState<{
    cameras: MediaDevice[]
    mics: MediaDevice[]
  }>({ cameras: [], mics: [] })
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const [selectedMicId, setSelectedMicId] = useState<string>("")

  // In-Call
  const [remoteParticipant, setRemoteParticipant] = useState<{
    sessionId: string
    userName?: string
  } | null>(null)
  const [partnerSpeaking, setPartnerSpeaking] = useState(false)
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [cameraFlipRotation, setCameraFlipRotation] = useState(0)

  // Refs für Cleanup & Guard
  const callObjectRef = useRef<DailyCall | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localPiPVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const micLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initGuardRef = useRef(false)

  // --- LOBBY: Lokale Vorschau mit getUserMedia (da URL erst beim Klick kommt) ---
  const startLobbyPreview = useCallback(async () => {
    if (initGuardRef.current) return
    try {
      const cameras: MediaDevice[] = []
      const mics: MediaDevice[] = []

      const devs = await navigator.mediaDevices.enumerateDevices()
      devs.forEach((d) => {
        if (d.kind === "videoinput")
          cameras.push({
            deviceId: d.deviceId,
            label: d.label || `Kamera ${cameras.length + 1}`,
            kind: "videoinput",
          })
        if (d.kind === "audioinput")
          mics.push({
            deviceId: d.deviceId,
            label: d.label || `Mikrofon ${mics.length + 1}`,
            kind: "audioinput",
          })
      })

      setDevices({ cameras, mics })
      const defaultCam = cameras[0]?.deviceId ?? ""
      const defaultMic = mics[0]?.deviceId ?? ""
      setSelectedCameraId(defaultCam)
      setSelectedMicId(defaultMic)

      const videoConstraint =
        callMode === "video"
          ? { deviceId: defaultCam ? { exact: defaultCam } : undefined }
          : false
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: defaultMic ? { deviceId: { exact: defaultMic } } : true,
      })
      setLocalStream(stream)
      localStreamRef.current = stream

      // Mikrofonpegel via AudioContext
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      audioContextRef.current = ctx
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        const avg =
          dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255
        setMicLevel(Math.min(1, avg * 3))
      }
      const id = setInterval(tick, 100)
      micLevelIntervalRef.current = id
      return () => {
        clearInterval(id)
        micLevelIntervalRef.current = null
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Gerätezugriff fehlgeschlagen: ${msg}`)
    }
  }, [callMode])

  useEffect(() => {
    if (phase !== "LOBBY") return
    let cleanup: (() => void) | undefined
    startLobbyPreview().then((fn) => {
      if (typeof fn === "function") cleanup = fn
    })
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      if (audioContextRef.current) audioContextRef.current.close()
      if (micLevelIntervalRef.current) {
        clearInterval(micLevelIntervalRef.current)
        micLevelIntervalRef.current = null
      }
      cleanup?.()
    }
  }, [phase, startLobbyPreview])

  // Lokales Video anzeigen
  useEffect(() => {
    if (!localVideoRef.current || !localStream) return
    localVideoRef.current.srcObject = localStream
  }, [localStream])

  // Gerätewechsel in Lobby
  const switchLobbyDevice = useCallback(
    async (kind: "videoinput" | "audioinput", deviceId: string) => {
      if (!localStream) return
      if (kind === "videoinput") {
        setSelectedCameraId(deviceId)
        const videoTrack = localStream.getVideoTracks()[0]
        if (videoTrack && callMode === "video") {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
          })
          const newTrack = newStream.getVideoTracks()[0]
          if (newTrack) {
            localStream.removeTrack(videoTrack)
            localStream.addTrack(newTrack)
            newStream.getTracks().forEach((t) => {
              if (t.kind === "audio") t.stop()
            })
          }
        }
      } else {
        setSelectedMicId(deviceId)
        const audioTrack = localStream.getAudioTracks()[0]
        if (audioTrack) {
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
          })
          const newTrack = newStream.getAudioTracks()[0]
          if (newTrack) {
            localStream.removeTrack(audioTrack)
            localStream.addTrack(newTrack)
            newStream.getVideoTracks().forEach((t) => t.stop())
          }
        }
      }
    },
    [localStream, callMode]
  )

  // --- JOINING: API aufrufen, CallObject erstellen, join() ---
  const handleJoin = useCallback(async () => {
    if (phase !== "LOBBY" || initGuardRef.current) return
    setPhase("JOINING")
    setError(null)

    try {
      const res = await fetch("/api/daily/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          callMode,
          userRole,
        }),
      })
      const data = (await res.json()) as {
        url?: string
        token?: string
        error?: string
      }

      if (!res.ok) {
        throw new Error(data.error ?? "API-Fehler")
      }

      const { url, token } = data
      if (!url || !token) {
        throw new Error("Keine URL oder Token erhalten.")
      }

      // CallObject erstellen (nur einmal)
      let call = callObjectRef.current
      if (!call) {
        call = Daily.createCallObject({
          subscribeToTracksAutomatically: true,
        })
        callObjectRef.current = call
      }

      await call.join({
        url,
        token,
        videoSource: selectedCameraId || true,
        audioSource: selectedMicId || true,
        startVideoOff: callMode === "voice",
      })

      setPhase("IN_CALL")
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setPhase("LOBBY")
    }
  }, [
    phase,
    bookingId,
    callMode,
    userRole,
    selectedCameraId,
    selectedMicId,
  ])

  // --- IN_CALL: Event-Listener, Timer, Remote-Track-Anzeige ---
  useEffect(() => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL") return

    initGuardRef.current = true

    const handleJoinedMeeting = () => {
      // 5-Minuten-Timer starten
      setTimerSecondsLeft(TIMER_DURATION_SEC)
      timerIntervalRef.current = setInterval(() => {
        setTimerSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current)
              timerIntervalRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    const handleParticipantJoined = (ev: { participant?: { session_id?: string; user_name?: string } }) => {
      const p = ev.participant
      if (p?.session_id && p.session_id !== call.participants()?.local?.session_id) {
        setRemoteParticipant({
          sessionId: p.session_id,
          userName: p.user_name,
        })
      }
    }

    const handleRemoteAudioLevel = (
      ev: import("@daily-co/daily-js").DailyEventObjectRemoteParticipantsAudioLevel
    ) => {
      const levels = ev.participantsAudioLevel ?? {}
      const maxLevel = Math.max(...Object.values(levels), 0)
      setPartnerSpeaking(maxLevel >= AUDIO_LEVEL_SPEAKING_THRESHOLD)
    }

    call.on("joined-meeting", handleJoinedMeeting)
    call.on("participant-joined", handleParticipantJoined)
    call.on("remote-participants-audio-level", handleRemoteAudioLevel)
    const handleLeftMeeting = () => {
      setPhase("LOBBY")
      setRemoteParticipant(null)
      setIsMuted(false)
      initGuardRef.current = false
    }
    call.on("left-meeting", handleLeftMeeting)

    call.startRemoteParticipantsAudioLevelObserver?.(200)

    // Bereits joined? (falls Event schon gefeuert)
    if (call.meetingState() === "joined-meeting") {
      handleJoinedMeeting()
    }

    const participants = call.participants()
    const localSessionId = participants?.local?.session_id
    if (participants) {
      for (const [_, p] of Object.entries(participants)) {
        if (p.session_id !== localSessionId) {
          setRemoteParticipant({
            sessionId: p.session_id,
            userName: (p as { user_name?: string }).user_name,
          })
          break
        }
      }
    }

    return () => {
      call.off("joined-meeting", handleJoinedMeeting)
      call.off("participant-joined", handleParticipantJoined)
      call.off("remote-participants-audio-level", handleRemoteAudioLevel)
      call.off("left-meeting", handleLeftMeeting)
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [phase])

  // Remote-Video-Track anzeigen
  useEffect(() => {
    const call = callObjectRef.current
    const videoEl = remoteVideoRef.current
    if (!call || !videoEl || phase !== "IN_CALL" || !remoteParticipant)
      return

    const participant = call.participants()[remoteParticipant.sessionId]
    const videoTrack = participant?.tracks?.video?.persistentTrack
    if (videoTrack && callMode === "video") {
      const stream = new MediaStream([videoTrack])
      videoEl.srcObject = stream
    }

    return () => {
      videoEl.srcObject = null
    }
  }, [phase, callMode, remoteParticipant])

  // Lokales Video (PiP) aus CallObject in IN_CALL
  useEffect(() => {
    const call = callObjectRef.current
    const videoEl = localPiPVideoRef.current
    if (!call || !videoEl || phase !== "IN_CALL" || callMode !== "video")
      return

    const local = call.participants().local
    const videoTrack = local?.tracks?.video?.persistentTrack
    if (videoTrack) {
      videoEl.srcObject = new MediaStream([videoTrack])
    }

    const onTrackStarted = (
      ev: import("@daily-co/daily-js").DailyEventObjectTrack
    ) => {
      if (
        ev.participant?.local &&
        ev.track?.kind === "video"
      ) {
        videoEl.srcObject = new MediaStream([ev.track])
      }
    }
    call.on("track-started", onTrackStarted)

    return () => {
      call.off("track-started", onTrackStarted)
      videoEl.srcObject = null
    }
  }, [phase, callMode])

  // --- cycleCamera (Mobile-Flip) ---
  const handleCycleCamera = useCallback(async () => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL") return
    try {
      setCameraFlipRotation((prev) => prev + 180)
      await call.cycleCamera({ preferDifferentFacingMode: true })
    } catch {
      setCameraFlipRotation((prev) => prev - 180)
    }
  }, [phase])

  // --- Mute toggle ---
  const handleToggleMute = useCallback(() => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL") return
    call.setLocalAudio(!isMuted)
    setIsMuted(!isMuted)
  }, [phase, isMuted])

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      const call = callObjectRef.current
      if (call) {
        call.leave()
        call.destroy()
        callObjectRef.current = null
      }
      initGuardRef.current = false
    }
  }, [])

  // --- Render ---

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => setError(null)}>
          Erneut versuchen
        </Button>
      </div>
    )
  }

  if (phase === "LOBBY") {
    return (
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-hidden rounded-lg border bg-card p-4">
        <h3 className="shrink-0 text-lg font-medium">Bereit zum Beitreten</h3>

        {/* Vorschau: aspect-video (16:9), kein max-h, Video füllt mit object-cover */}
        <div className="relative w-full overflow-hidden rounded-lg bg-muted aspect-video shrink-0">
          {callMode === "video" && localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Avatar className="size-24">
                <AvatarFallback className="text-2xl">
                  {partnerName?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          {/* Mikrofonpegel */}
          <div className="absolute bottom-2 left-2 right-2 h-1.5 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-green-500/90 transition-all"
              style={{ width: `${Math.round(micLevel * 100)}%` }}
            />
          </div>
        </div>

        {/* Device Selector + Button - immer sichtbar */}
        <div className="flex shrink-0 flex-col gap-2">
          {callMode === "video" && devices.cameras.length > 1 && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Kamera
              </label>
              <Select
                value={selectedCameraId}
                onValueChange={(v) => switchLobbyDevice("videoinput", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {devices.cameras.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Mikrofon
            </label>
            <Select
              value={selectedMicId}
              onValueChange={(v) => switchLobbyDevice("audioinput", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {devices.mics.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="shrink-0" onClick={handleJoin}>Beitreten</Button>
      </div>
    )
  }

  if (phase === "JOINING") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Beitreten...</p>
      </div>
    )
  }

  // Timer-Farb-Logik: > 2 min grün, < 2 min gelb, < 30 sec rot + blinken
  const secs = timerSecondsLeft ?? 0
  const timerColorClass =
    secs > 120
      ? "text-emerald-600 dark:text-emerald-400"
      : secs > 30
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"
  const timerBlink = secs > 0 && secs <= 30

  // IN_CALL: max-h-[80vh] damit Bedienelemente immer im Sichtfeld
  return (
    <div className="relative flex max-h-[80vh] flex-col overflow-hidden rounded-lg border bg-card">
      {/* Video-Bereich: aspect-video Container, overflow-hidden, Videos object-cover w-full h-full */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-lg bg-muted">
        <div className="absolute inset-0 overflow-hidden bg-muted">
          {callMode === "video" ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-8">
              {/* Voice: großes Profilbild (size-40/48) mit sanft pulsierendem Ring */}
              <div className="relative flex items-center justify-center">
                {partnerSpeaking && (
                <div
                  className="absolute left-1/2 top-1/2 size-[11rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/50 md:size-[13rem] animate-voice-pulse-ring"
                  aria-hidden
                />
                )}
                <Avatar className="relative z-10 size-40 transition-transform duration-300 ease-out md:size-48">
                  {partnerImageUrl ? (
                    <AvatarImage src={partnerImageUrl} alt={partnerName} />
                  ) : null}
                  <AvatarFallback className="text-5xl md:text-6xl">
                    {partnerName?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          )}
        </div>

        {/* 5-Minuten-Timer: dezentes Overlay oben */}
        {timerSecondsLeft !== null && (
          <div
            className={cn(
              "absolute left-4 top-4 z-10 rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium tabular-nums backdrop-blur-sm",
              timerColorClass,
              timerBlink && "animate-timer-blink"
            )}
          >
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </div>
        )}

        {/* Lokales Video als PiP (Video-Mode) */}
        {callMode === "video" && (
          <div className="absolute bottom-2 right-2 z-10 aspect-video w-24 overflow-hidden rounded-lg border-2 border-white/20 shadow-lg">
            <video
              ref={localPiPVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Steuerungsleiste: fixiert unten, immer sichtbar, Safe Area */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-center gap-3 border-t bg-card/95 px-4 py-4 backdrop-blur-sm",
          "pb-[max(1rem,env(safe-area-inset-bottom))]"
        )}
      >
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="icon"
          className="size-12 transition-transform active:scale-95 md:size-14"
          onClick={handleToggleMute}
          title={isMuted ? "Mikrofon einschalten" : "Mikrofon stummschalten"}
        >
          {isMuted ? (
            <MicOff className="size-5 md:size-6" />
          ) : (
            <Mic className="size-5 md:size-6" />
          )}
        </Button>

        {callMode === "video" && (
          <Button
            variant="outline"
            size="icon"
            className="size-12 transition-transform active:scale-95 md:size-14"
            onClick={handleCycleCamera}
            title="Kamera wechseln (Front/Rück)"
          >
            <FlipHorizontal
              className="size-5 transition-transform duration-300 md:size-6"
              style={{ transform: `rotate(${cameraFlipRotation}deg)` }}
            />
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          className="size-12 transition-transform active:scale-95 md:size-14"
          onClick={() => callObjectRef.current?.leave()}
          title="Auflegen"
        >
          <PhoneOff className="size-5 md:size-6" />
        </Button>
      </div>
    </div>
  )
}

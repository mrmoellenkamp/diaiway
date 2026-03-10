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
import { FlipHorizontal, Loader2, Mic, MicOff, PhoneOff } from "lucide-react"

// --- State Machine ---
type CallPhase = "LOBBY" | "JOINING" | "IN_CALL"

type CallMode = "video" | "voice"
type UserRole = "shugyo" | "takumi"

interface DailyCallContainerProps {
  bookingId: string
  callMode: CallMode
  userRole: UserRole
  partnerImageUrl?: string | null
  partnerName?: string
}

interface MediaDevice {
  deviceId: string
  label: string
  kind: "videoinput" | "audioinput"
}

const TIMER_DURATION_SEC = 5 * 60
const AUDIO_LEVEL_SPEAKING_THRESHOLD = 0.02

export function DailyCallContainer({
  bookingId,
  callMode,
  userRole,
  partnerImageUrl,
  partnerName = "Partner",
}: DailyCallContainerProps) {
  const [phase, setPhase] = useState<CallPhase>("LOBBY")
  const [error, setError] = useState<string | null>(null)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const [devices, setDevices] = useState<{ cameras: MediaDevice[]; mics: MediaDevice[] }>({
    cameras: [],
    mics: [],
  })
  const [selectedCameraId, setSelectedCameraId] = useState<string>("")
  const [selectedMicId, setSelectedMicId] = useState<string>("")

  const [remoteParticipant, setRemoteParticipant] = useState<{
    sessionId: string
    userName?: string
    hasVideo?: boolean
  } | null>(null)
  const [partnerSpeaking, setPartnerSpeaking] = useState(false)
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [cameraFlipRotation, setCameraFlipRotation] = useState(0)
  const [showPartnerSearchWarning, setShowPartnerSearchWarning] = useState(false)

  const callObjectRef = useRef<DailyCall | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localPiPVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const micLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initGuardRef = useRef(false)
  const remoteSessionIdRef = useRef<string | null>(null)

  // --- Cleanup: Nur Ressourcen freigeben, KEIN Redirect ---
  const performCleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    micLevelIntervalRef.current && clearInterval(micLevelIntervalRef.current)
    micLevelIntervalRef.current = null
    audioContextRef.current?.close()
    timerIntervalRef.current && clearInterval(timerIntervalRef.current)
    timerIntervalRef.current = null

    const call = callObjectRef.current
    if (call) {
      try {
        call.leave()
        call.destroy()
      } catch (e) {
        console.warn("[DailyCall] performCleanup leave/destroy:", e)
      }
      callObjectRef.current = null
    }
    initGuardRef.current = false
  }, [])

  // --- Redirect: NUR bei expliziter User-Aktion, mit Sicherheitsabfrage ---
  const redirectToSessions = useCallback((triggeredBy: string) => {
    if (typeof window === "undefined") return
    if (phase == null || phase === undefined) {
      console.warn("[DailyCall] Redirect SKIPPED – phase was null/undefined | triggered by:", triggeredBy)
      return
    }
    console.log("[DailyCall] Redirect triggered by:", triggeredBy)
    window.location.href = "/sessions"
  }, [phase])

  const forceCleanupAndRedirect = useCallback((triggeredBy: string) => {
    performCleanup()
    redirectToSessions(triggeredBy)
  }, [performCleanup, redirectToSessions])

  // --- LOBBY: getUserMedia ---
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
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255
        setMicLevel(Math.min(1, avg * 3))
      }
      const id = setInterval(tick, 100)
      micLevelIntervalRef.current = id
      return () => {
        clearInterval(id)
        micLevelIntervalRef.current = null
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
      audioContextRef.current?.close()
      micLevelIntervalRef.current && clearInterval(micLevelIntervalRef.current)
      cleanup?.()
    }
  }, [phase, startLobbyPreview])

  useEffect(() => {
    if (!localVideoRef.current || !localStream) return
    localVideoRef.current.srcObject = localStream
  }, [localStream])

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
            newStream.getTracks().forEach((t) => (t.kind === "audio" ? t.stop() : undefined))
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

  // --- JOIN ---
  const handleJoin = useCallback(async () => {
    if (phase !== "LOBBY" || initGuardRef.current) return
    setPhase("JOINING")
    setError(null)
    try {
      const res = await fetch("/api/daily/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, callMode, userRole }),
      })
      const data = (await res.json()) as { url?: string; token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "API-Fehler")
      const { url, token } = data
      if (!url || !token) throw new Error("Keine URL oder Token erhalten.")

      console.log("--- JOIN ATTEMPT ---")
      console.log("URL:", url)
      console.log("TOKEN-PREFIX:", token?.substring(0, 20))

      let call = callObjectRef.current
      if (!call) {
        call = Daily.createCallObject({ subscribeToTracksAutomatically: true })
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
      setError(e instanceof Error ? e.message : String(e))
      setPhase("LOBBY")
    }
  }, [phase, bookingId, callMode, userRole, selectedCameraId, selectedMicId])

  // --- IN_CALL: Events ---
  useEffect(() => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL") return
    initGuardRef.current = true

    const handleJoinedMeeting = () => {
      const participants = call.participants()
      console.log("INTERNER RAUM-NAME:", (participants?.local as any)?.room_name)
      setTimerSecondsLeft(TIMER_DURATION_SEC)
      timerIntervalRef.current = setInterval(() => {
        setTimerSecondsLeft((prev) => {
          if (prev === null || prev <= 1) {
            timerIntervalRef.current && clearInterval(timerIntervalRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    const handleParticipantJoined = (ev: any) => {
      console.log("PARTICIPANT DETECTED:", ev?.participant?.session_id)
      const p = ev?.participant
      if (p?.session_id && p.session_id !== call.participants()?.local?.session_id) {
        remoteSessionIdRef.current = p.session_id
        const part = call.participants()[p.session_id]
        setRemoteParticipant({
          sessionId: p.session_id,
          userName: p.user_name,
          hasVideo: !!(part?.tracks?.video?.persistentTrack ?? part?.tracks?.video?.track),
        })
      }
    }

    const handleParticipantUpdated = (ev: { participant?: { session_id?: string } }) => {
      const p = ev.participant
      if (!p?.session_id || p.session_id === call.participants()?.local?.session_id) return
      const part = call.participants()[p.session_id] as {
        tracks?: { video?: { state?: string; persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack } }
      } | undefined
      const videoTrackObj = part?.tracks?.video
      const videoTrack = videoTrackObj?.persistentTrack ?? videoTrackObj?.track
      const isPlayable = videoTrackObj?.state === "playable"
      if (isPlayable && videoTrack && remoteVideoRef.current && p.session_id === remoteSessionIdRef.current) {
        remoteVideoRef.current.srcObject = new MediaStream([videoTrack])
        remoteVideoRef.current.play().catch(() => {})
      }
      setRemoteParticipant((prev) => {
        if (!prev || prev.sessionId !== p.session_id) return prev
        return {
          ...prev,
          sessionId: prev.sessionId,
          hasVideo: !!videoTrack,
        }
      })
    }

    const handleParticipantLeft = (ev: { participant?: { session_id?: string } }) => {
      if (ev.participant?.session_id === remoteSessionIdRef.current) {
        remoteSessionIdRef.current = null
        setRemoteParticipant(null)
      }
    }

    const handleRemoteAudioLevel = (
      ev: import("@daily-co/daily-js").DailyEventObjectRemoteParticipantsAudioLevel
    ) => {
      const levels = ev.participantsAudioLevel ?? {}
      const maxLevel = Math.max(...Object.values(levels), 0)
      setPartnerSpeaking(maxLevel >= AUDIO_LEVEL_SPEAKING_THRESHOLD)
    }

    const handleTrackStarted = (ev: import("@daily-co/daily-js").DailyEventObjectTrack) => {
      if (ev.participant?.session_id !== remoteSessionIdRef.current || ev.track?.kind !== "video") return
      const t = ev.track as MediaStreamTrack | { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }
      const mediaTrack = t instanceof MediaStreamTrack ? t : t?.persistentTrack ?? t?.track
      if (mediaTrack && remoteVideoRef.current) {
        const el = remoteVideoRef.current
        el.srcObject = new MediaStream([mediaTrack])
        el.play().catch(() => {})
      }
      setRemoteParticipant((prev) => prev ? { ...prev, sessionId: prev.sessionId, hasVideo: true } : prev)
    }

    const handleError = (err: any) => console.error("DAILY AUTH ERROR:", err)
    call.on("error", handleError)
    call.on("joined-meeting", handleJoinedMeeting)
    call.on("participant-joined", handleParticipantJoined)
    call.on("participant-updated", handleParticipantUpdated)
    call.on("participant-left", handleParticipantLeft)
    call.on("remote-participants-audio-level", handleRemoteAudioLevel)
    call.on("track-started", handleTrackStarted)
    call.on("left-meeting", () => {
      remoteSessionIdRef.current = null
      setPhase("LOBBY")
      setRemoteParticipant(null)
      setIsMuted(false)
      initGuardRef.current = false
    })

    call.startRemoteParticipantsAudioLevelObserver?.(200)

    if (call.meetingState() === "joined-meeting") handleJoinedMeeting()

    const participants = call.participants()
    const localSessionId = participants?.local?.session_id
    for (const [, p] of Object.entries(participants ?? {})) {
      if (p.session_id !== localSessionId) {
        const pTracks = (p as { tracks?: { video?: { persistentTrack?: unknown; track?: unknown } } })?.tracks?.video
        setRemoteParticipant({
          sessionId: p.session_id,
          userName: (p as { user_name?: string }).user_name,
          hasVideo: !!(pTracks?.persistentTrack ?? pTracks?.track),
        })
        break
      }
    }

    return () => {
      call.off("error", handleError)
      call.off("joined-meeting", handleJoinedMeeting)
      call.off("participant-joined", handleParticipantJoined)
      call.off("participant-updated", handleParticipantUpdated)
      call.off("participant-left", handleParticipantLeft)
      call.off("remote-participants-audio-level", handleRemoteAudioLevel)
      call.off("track-started", handleTrackStarted)
      timerIntervalRef.current && clearInterval(timerIntervalRef.current)
    }
  }, [phase])

  // --- Zuweisung: Remote-Video-Track → remoteVideoRef (wird mehrfach verwendet) ---
  const assignRemoteVideoTrack = useCallback(() => {
    const call = callObjectRef.current
    const videoEl = remoteVideoRef.current
    if (!call || !videoEl || phase !== "IN_CALL" || callMode !== "video" || !remoteParticipant) return
    const participant = call.participants()[remoteParticipant.sessionId] as
      | {
          tracks?: {
            video?: {
              state?: string
              persistentTrack?: MediaStreamTrack
              track?: MediaStreamTrack
            }
          }
        }
      | undefined
    const videoTrackObj = participant?.tracks?.video
    const videoTrack = videoTrackObj?.persistentTrack ?? videoTrackObj?.track
    if (videoTrack) {
      videoEl.srcObject = new MediaStream([videoTrack])
      videoEl.play().catch(() => {})
    }
  }, [phase, callMode, remoteParticipant?.sessionId, remoteParticipant?.hasVideo])

  // --- Video-Mapping useEffect: reagiert auf remoteParticipant + track ---
  useEffect(() => {
    const call = callObjectRef.current
    const videoEl = remoteVideoRef.current
    if (!call || !videoEl || phase !== "IN_CALL" || callMode !== "video") return
    if (!remoteParticipant) {
      videoEl.srcObject = null
      return
    }
    const participant = call.participants()[remoteParticipant.sessionId]
    console.log("[DailyCall] Tracks von Partner:", participant?.tracks)
    assignRemoteVideoTrack()
    return () => {
      videoEl.srcObject = null
    }
  }, [phase, callMode, remoteParticipant?.sessionId, remoteParticipant?.hasVideo, assignRemoteVideoTrack])

  // --- Force-Update: Nach 2 Sekunden erneut zuweisen, falls Video schwarz bleibt ---
  useEffect(() => {
    if (phase !== "IN_CALL" || callMode !== "video" || !remoteParticipant?.hasVideo) return
    const t = setTimeout(() => assignRemoteVideoTrack(), 2000)
    return () => clearTimeout(t)
  }, [phase, callMode, remoteParticipant?.sessionId, remoteParticipant?.hasVideo, assignRemoteVideoTrack])

  // --- Warnung: remoteParticipant nach 5 Sekunden immer noch null ---
  useEffect(() => {
    if (phase !== "IN_CALL" || remoteParticipant) {
      setShowPartnerSearchWarning(false)
      return
    }
    const t = setTimeout(() => setShowPartnerSearchWarning(true), 5000)
    return () => clearTimeout(t)
  }, [phase, remoteParticipant])

  // --- Lokales PiP (Video-Mode) ---
  useEffect(() => {
    const call = callObjectRef.current
    const videoEl = localPiPVideoRef.current
    if (!call || !videoEl || phase !== "IN_CALL" || callMode !== "video") return
    const local = call.participants().local
    const videoTrack = local?.tracks?.video?.persistentTrack
    if (videoTrack) videoEl.srcObject = new MediaStream([videoTrack])

    const onTrackStarted = (ev: import("@daily-co/daily-js").DailyEventObjectTrack) => {
      if (!ev.participant?.local || ev.track?.kind !== "video") return
      const t = ev.track as MediaStreamTrack | { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }
      const mediaTrack = t instanceof MediaStreamTrack ? t : t?.persistentTrack ?? t?.track
      if (mediaTrack) {
        videoEl.srcObject = new MediaStream([mediaTrack])
      }
    }
    call.on("track-started", onTrackStarted)
    return () => {
      call.off("track-started", onTrackStarted)
      videoEl.srcObject = null
    }
  }, [phase, callMode])

  const handleCycleCamera = useCallback(async () => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL") return
    try {
      setCameraFlipRotation((p) => p + 180)
      await call.cycleCamera({ preferDifferentFacingMode: true })
    } catch {
      setCameraFlipRotation((p) => p - 180)
    }
  }, [phase])

  const handleToggleMute = useCallback(() => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL") return
    call.setLocalAudio(!isMuted)
    setIsMuted(!isMuted)
  }, [phase, isMuted])

  // --- Cleanup NUR bei echtem Unmount (nicht bei Re-Render/Strict Mode Remount) ---
  useEffect(() => {
    return () => {
      console.log("[DailyCall] Cleanup: Komponente unmountet – performCleanup (KEIN Redirect)")
      performCleanup()
    }
  }, [performCleanup])

  // --- App Shell (unzerstörbare Struktur) ---
  const shellClass = "fixed inset-0 h-[100dvh] w-full flex flex-col bg-background overflow-hidden"

  if (error) {
    return (
      <div className={cn(shellClass, "items-center justify-center p-6")}>
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/50 bg-destructive/10 p-6">
          <p className="text-center text-destructive">{error}</p>
          <Button variant="outline" onClick={() => setError(null)}>
            Erneut versuchen
          </Button>
          <Button variant="ghost" onClick={() => forceCleanupAndRedirect("error-ZurückButton")}>
            Zurück zu Sessions
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "LOBBY") {
    return (
      <div className={shellClass}>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 overflow-y-auto p-4">
          <h3 className="text-lg font-semibold">Bereit zum Beitreten</h3>
          <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-black aspect-video shrink-0">
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
                <Avatar className="size-20">
                  <AvatarFallback className="text-2xl">{partnerName?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 h-1.5 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-green-500/90 transition-all"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex w-full max-w-md shrink-0 flex-col gap-3">
            {callMode === "video" && devices.cameras.length > 1 && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Kamera</label>
                <Select value={selectedCameraId} onValueChange={(v) => switchLobbyDevice("videoinput", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {devices.cameras.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Mikrofon</label>
              <Select value={selectedMicId} onValueChange={(v) => switchLobbyDevice("audioinput", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {devices.mics.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleJoin} className="h-12">Beitreten</Button>
            <Button variant="ghost" onClick={() => forceCleanupAndRedirect("Lobby-Abbrechen")}>
              Abbrechen
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "JOINING") {
    return (
      <div className={cn(shellClass, "items-center justify-center")}>
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Beitreten...</p>
      </div>
    )
  }

  // IN_CALL: App Shell mit Video + Steuerungsleiste
  const secs = timerSecondsLeft ?? 0
  const timerColorClass =
    secs > 120 ? "text-emerald-400" : secs > 30 ? "text-amber-400" : "text-red-400"
  const timerBlink = secs > 0 && secs <= 30

  const hasRemoteVideo =
    callMode === "video" && remoteParticipant?.hasVideo
  const showVideoFallback = callMode === "video" && !hasRemoteVideo

  return (
    <div className={shellClass}>
      {/* Video-Bereich (Top): flex-1 relative bg-black */}
      <div className="relative flex-1 bg-black">
        {callMode === "video" ? (
          <>
            <div className="absolute left-2 top-14 z-20 rounded bg-black/80 px-2 py-1 font-mono text-xs text-white">
              {remoteParticipant?.hasVideo ? "Video erkannt" : "Kein Video-Signal"} | sessionId: {remoteParticipant?.sessionId ?? "–"}
            </div>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className={cn(
                "absolute inset-0 h-full w-full",
                hasRemoteVideo ? "z-10" : "z-0",
                "sm:object-cover object-contain"
              )}
            />
            {/* Platzhalter NUR wenn !hasRemoteVideo – z-10 damit über leeres Video */}
            {showVideoFallback && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80" aria-hidden>
                <Avatar className="size-24 sm:size-32">
                  {partnerImageUrl ? (
                    <AvatarImage src={partnerImageUrl} alt={partnerName} />
                  ) : null}
                  <AvatarFallback className="text-4xl sm:text-5xl">
                    {partnerName?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "relative rounded-full",
                partnerSpeaking && "animate-voice-pulse-ring"
              )}
            >
              {partnerSpeaking && (
                <div
                  className="absolute left-1/2 top-1/2 size-[10rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/50 sm:size-[12rem] animate-voice-pulse-ring"
                  aria-hidden
                />
              )}
              <Avatar className="relative z-10 size-32 sm:size-40">
                {partnerImageUrl ? (
                  <AvatarImage src={partnerImageUrl} alt={partnerName} />
                ) : null}
                <AvatarFallback className="text-5xl sm:text-6xl">
                  {partnerName?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        )}

        {showPartnerSearchWarning && (
          <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-medium text-black">
            Suche Partner im Raum…
          </div>
        )}
        {timerSecondsLeft !== null && (
          <div
            className={cn(
              "absolute left-3 top-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-sm font-medium tabular-nums backdrop-blur-sm sm:left-4 sm:top-4 sm:px-3 sm:py-1.5",
              timerColorClass,
              timerBlink && "animate-timer-blink"
            )}
          >
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </div>
        )}

        {callMode === "video" && (
          <div className="absolute bottom-3 right-3 z-10 aspect-video w-20 overflow-hidden rounded-lg border-2 border-white/20 shadow-lg sm:bottom-4 sm:right-4 sm:w-24">
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

      {/* Steuerungsleiste (Bottom): h-20 sm:h-24, Safe Area */}
      <div
        className={cn(
          "flex h-20 flex-shrink-0 items-center justify-center gap-3 border-t bg-card px-4 sm:h-24 sm:gap-4",
          "pb-[env(safe-area-inset-bottom)]"
        )}
      >
        <Button
          variant={isMuted ? "destructive" : "outline"}
          size="icon"
          className="size-10 sm:size-12 transition-transform active:scale-95"
          onClick={handleToggleMute}
          title={isMuted ? "Mikrofon an" : "Mikrofon aus"}
        >
          {isMuted ? <MicOff className="size-5 sm:size-6" /> : <Mic className="size-5 sm:size-6" />}
        </Button>

        {callMode === "video" && (
          <Button
            variant="outline"
            size="icon"
            className="size-10 sm:size-12 transition-transform active:scale-95"
            onClick={handleCycleCamera}
            title="Kamera wechseln"
          >
            <FlipHorizontal
              className="size-5 sm:size-6 transition-transform duration-300"
              style={{ transform: `rotate(${cameraFlipRotation}deg)` }}
            />
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          className="size-10 sm:size-12 transition-transform active:scale-95"
          onClick={() => forceCleanupAndRedirect("Auflegen-Button")}
          title="Auflegen"
        >
          <PhoneOff className="size-5 sm:size-6" />
        </Button>
      </div>
    </div>
  )
}

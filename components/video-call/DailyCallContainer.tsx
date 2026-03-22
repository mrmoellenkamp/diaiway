"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Daily from "@daily-co/daily-js"
import type { DailyCall } from "@daily-co/daily-js"

import { Button } from "@/components/ui/button"
import {
  cancelSessionActiveNotification,
  hapticHeavy,
  hapticMedium,
  scheduleSessionActiveNotification,
} from "@/lib/native-utils"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { FlipHorizontal, Loader2, Maximize2, Mic, MicOff, PhoneOff, PictureInPicture, Square, Video, VideoOff, Wallet } from "lucide-react"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import { useWalletTopup } from "@/lib/wallet-topup-context"
import { useSafeSnapshot } from "@/hooks/use-safe-snapshot"
import { useSessionActivity } from "@/components/session-activity-provider"
import { useHeartbeat } from "@/hooks/use-heartbeat"

// --- State Machine ---
type CallPhase = "LOBBY" | "JOINING" | "IN_CALL"
type ReconnectState = { phase: "waiting"; secondsLeft: number } | null

type CallMode = "video" | "voice"
type UserRole = "shugyo" | "takumi"

interface DailyCallContainerProps {
  bookingId: string
  callMode: CallMode
  userRole: UserRole
  partnerImageUrl?: string | null
  partnerName?: string
  /** Pre-Call Safety bereits bestätigt (nur Video). Bei Voice entfällt das Modal. */
  safetyAcceptedAt?: string | Date | null
  /** Called when user successfully joins (after start-session); optional. */
  onSessionStarted?: () => void
  /** Called when call ends (Auflegen/report-and-leave); parent can show post-call screen instead of redirect. */
  onCallEnded?: () => void
  /** Paket 3: Billing-Timer für Instant-Calls (Shugyo) */
  bookingMode?: "scheduled" | "instant"
  sessionStartedAt?: string | null
  userBalanceCents?: number
  pricePerMinuteCents?: number
  hasPaidBefore?: boolean
}

interface MediaDevice {
  deviceId: string
  label: string
  kind: "videoinput" | "audioinput"
}

const TIMER_DURATION_SEC = 5 * 60
const AUDIO_LEVEL_SPEAKING_THRESHOLD = 0.02
const MAX_JOIN_RETRIES = 3
const JOIN_RETRY_DELAYS_MS = [2000, 2500, 3000] as const

/** Paket 3: Berechnet Restzeit in Sekunden für Instant-Abrechnung. */
function calculateRemainingTime(
  sessionStartMs: number,
  hasPaidBefore: boolean,
  userBalanceCents: number,
  pricePerMinuteCents: number,
  frozenDurationMs = 0
): number {
  if (pricePerMinuteCents <= 0) return TIMER_DURATION_SEC
  const freePeriodSec = hasPaidBefore ? 30 : 5 * 60 // 30 Sek Zweitkontakt, 5 Min Erstkontakt
  const elapsedSec = (Date.now() - sessionStartMs - frozenDurationMs) / 1000
  const billingElapsedSec = Math.max(0, elapsedSec - freePeriodSec)
  const balanceMinutes = userBalanceCents / pricePerMinuteCents
  const remainingSec = Math.max(0, balanceMinutes * 60 - billingElapsedSec)
  return Math.round(remainingSec)
}

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

export function DailyCallContainer({
  bookingId,
  callMode,
  userRole,
  partnerImageUrl,
  partnerName = "Partner",
  safetyAcceptedAt,
  onSessionStarted,
  onCallEnded,
  bookingMode,
  sessionStartedAt,
  userBalanceCents = 0,
  pricePerMinuteCents = 0,
  hasPaidBefore = false,
}: DailyCallContainerProps) {
  const { t } = useI18n()
  const { setCallActive } = useSessionActivity()
  const [phase, setPhase] = useState<CallPhase>("LOBBY")
  const [error, setError] = useState<string | null>(null)
  const [isPiPActive, setIsPiPActive] = useState(false)

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
    hasAudio?: boolean
    audioTrack?: MediaStreamTrack
  } | null>(null)
  const [partnerSpeaking, setPartnerSpeaking] = useState(false)
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [cameraFlipRotation, setCameraFlipRotation] = useState(0)
  const [showPartnerSearchWarning, setShowPartnerSearchWarning] = useState(false)

  // Pre-Call Safety: nur Video; Voice entfällt (README)
  const needsSafetyModal = callMode === "video" && !safetyAcceptedAt
  const [safetyAccepted, setSafetyAccepted] = useState(!!safetyAcceptedAt)
  const [safetyCheck1, setSafetyCheck1] = useState(false)
  const [safetyCheck2, setSafetyCheck2] = useState(false)
  const [safetyCheck3, setSafetyCheck3] = useState(false)
  const [safetyCheck4, setSafetyCheck4] = useState(false)
  const [safetyCheck5, setSafetyCheck5] = useState(false)
  const [safetySubmitting, setSafetySubmitting] = useState(false)

  // PRE_CHECK Gate (nur Video): Blitzlicht-Snapshot bei 0s muss safe sein
  const [preCheckPassed, setPreCheckPassed] = useState(false)
  const [preCheckLoading, setPreCheckLoading] = useState(false)
  const [preCheckError, setPreCheckError] = useState<string | null>(null)

  const canJoin =
    (!needsSafetyModal || safetyAccepted) &&
    (callMode !== "video" || preCheckPassed)

  useEffect(() => {
    if (safetyAcceptedAt) setSafetyAccepted(true)
  }, [safetyAcceptedAt])

  // Kein Inaktivitäts-Logout während Verbindungsaufbau oder laufendem Call; Heartbeat hält Server-Cookie frisch
  const isSessionCallPhase = phase === "JOINING" || phase === "IN_CALL"
  useHeartbeat(isSessionCallPhase)
  useEffect(() => {
    setCallActive(isSessionCallPhase)
    return () => setCallActive(false)
  }, [isSessionCallPhase, setCallActive])

  // PRE_CHECK: Blitzlicht bei 0s (nur Video, nur wenn Safety bestätigt + localStream da)
  const preCheckRanRef = useRef(false)
  useEffect(() => {
    if (callMode !== "video" || phase !== "LOBBY") {
      if (callMode === "voice") setPreCheckPassed(true)
      return
    }
    if (!safetyAccepted || !localStream) {
      setPreCheckPassed(false)
      preCheckRanRef.current = false
      return
    }
    if (preCheckRanRef.current) return
    preCheckRanRef.current = true
    setPreCheckLoading(true)
    setPreCheckError(null)
    const t = setTimeout(async () => {
      const videoEl = localVideoRef.current
      if (!videoEl?.srcObject || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
        setPreCheckPassed(false)
        setPreCheckError("Kamerabild noch nicht bereit. Bitte warte einen Moment.")
        setPreCheckLoading(false)
        preCheckRanRef.current = false
        return
      }
      try {
        const canvas = document.createElement("canvas")
        const w = Math.min(videoEl.videoWidth, 640)
        const h = Math.round((w / videoEl.videoWidth) * videoEl.videoHeight)
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          setPreCheckPassed(false)
          return
        }
        ctx.drawImage(videoEl, 0, 0, w, h)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
        const res = await fetch("/api/safety/pre-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, imageBase64: dataUrl }),
        })
        const data = await res.json()
        if (data.safe) {
          setPreCheckPassed(true)
          setPreCheckError(null)
        } else {
          setPreCheckPassed(false)
          setPreCheckError(data.reason ?? "Bildprüfung fehlgeschlagen.")
          preCheckRanRef.current = false
        }
      } catch (e) {
        setPreCheckPassed(false)
        setPreCheckError(e instanceof Error ? e.message : "Prüfung fehlgeschlagen.")
        preCheckRanRef.current = false
      } finally {
        setPreCheckLoading(false)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [callMode, phase, safetyAccepted, localStream, bookingId])

  const handleSafetyConfirm = useCallback(async () => {
    if (!safetyCheck1 || !safetyCheck2 || !safetyCheck3 || !safetyCheck4 || !safetyCheck5) return
    setSafetySubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept-safety" }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? "Fehler")
      setSafetyAccepted(true)
    } catch (e) {
      console.warn("[DailyCall] accept-safety:", e)
    } finally {
      setSafetySubmitting(false)
    }
  }, [bookingId, safetyCheck1, safetyCheck2, safetyCheck3, safetyCheck4, safetyCheck5])

  const callObjectRef = useRef<DailyCall | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const localPiPVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const micLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initGuardRef = useRef(false)
  const remoteSessionIdRef = useRef<string | null>(null)
  const joinUrlRef = useRef<string | null>(null)
  const sessionStartMsRef = useRef<number | null>(null)
  const lowBalanceWarningShownRef = useRef(false)
  const frozenAtMsRef = useRef<number | null>(null)
  const frozenDurationMsRef = useRef<number>(0)
  const balanceCentsRef = useRef<number | null>(null)
  const joinCredentialsRef = useRef<{ url: string; token: string } | null>(null)
  const serverSessionStartMsRef = useRef<number | null>(null)
  const haptic4MinFiredRef = useRef(false)
  const haptic5MinFiredRef = useRef(false)
  const appStateRemoveRef = useRef<(() => void) | null>(null)
  const joinRetryCountRef = useRef(0)
  const joinRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleJoinRef = useRef<((isRetry?: boolean) => Promise<void>) | null>(null)

  const [isFrozen, setIsFrozen] = useState(false)
  const [reconnectState, setReconnectState] = useState<ReconnectState>(null)
  const [isShugyoFrozen, setIsShugyoFrozen] = useState(false)
  const [balanceCentsForTimer, setBalanceCentsForTimer] = useState<number | null>(null)
  const { openWalletTopup } = useWalletTopup()

  const useBillingTimer =
    bookingMode === "instant" &&
    userRole === "shugyo" &&
    pricePerMinuteCents > 0

  useEffect(() => {
    balanceCentsRef.current = balanceCentsForTimer
  }, [balanceCentsForTimer])

  // Server-backed session start for timer sync (no reset on reconnect)
  useEffect(() => {
    if (sessionStartedAt) {
      serverSessionStartMsRef.current = new Date(sessionStartedAt).getTime()
    }
  }, [sessionStartedAt])

  // --- Cleanup: Nur Ressourcen freigeben, KEIN Redirect ---
  const performCleanup = useCallback(() => {
    const call = callObjectRef.current
    if (call) {
      try {
        call.setLocalVideo(false)
        call.setLocalAudio(false)
      } catch (e) {
        console.warn("[DailyCall] cleanup setLocalVideo/Audio:", e)
      }
      try {
        call.leave()
        call.destroy()
      } catch (e) {
        console.warn("[DailyCall] performCleanup leave/destroy:", e)
      }
      callObjectRef.current = null
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (micLevelIntervalRef.current) clearInterval(micLevelIntervalRef.current)
    micLevelIntervalRef.current = null
    audioContextRef.current?.close()
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    timerIntervalRef.current = null
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current.pause()
    }
    initGuardRef.current = false
    if (joinRetryTimeoutRef.current) clearTimeout(joinRetryTimeoutRef.current)
    joinRetryTimeoutRef.current = null
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

  // --- IN_CALL: Auflegen (end-session) ---
  const handleAuflegen = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end-session" }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        console.warn("[DailyCall] end-session failed:", data.error)
      }
    } catch (e) {
      console.warn("[DailyCall] end-session error:", e)
    }
    performCleanup()
    if (onCallEnded) onCallEnded()
    else redirectToSessions("Auflegen-Button")
  }, [bookingId, performCleanup, onCallEnded, redirectToSessions])

  // --- IN_CALL: Report and leave ---
  const handleReportAndLeave = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report-and-leave" }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        console.warn("[DailyCall] report-and-leave failed:", data.error)
      }
    } catch (e) {
      console.warn("[DailyCall] report-and-leave error:", e)
    }
    performCleanup()
    if (onCallEnded) onCallEnded()
    else redirectToSessions("report-and-leave")
  }, [bookingId, performCleanup, onCallEnded, redirectToSessions])

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
      if (micLevelIntervalRef.current) clearInterval(micLevelIntervalRef.current)
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
  const handleJoin = useCallback(async (isRetry = false) => {
    if ((phase !== "LOBBY" && !isRetry) || initGuardRef.current) return
    if (phase !== "JOINING") setPhase("JOINING")
    if (!isRetry) joinRetryCountRef.current = 0
    setError(null)
    try {
      const { checkConnectivity } = await import("@/lib/native-utils")
      const { connected } = await checkConnectivity()
      if (!connected) {
        setPhase("LOBBY")
        toast.error(t("toast.noConnection"))
        return
      }
      const existingCall = callObjectRef.current
      if (existingCall) {
        try {
          await existingCall.leave()
          existingCall.destroy()
        } catch (e) {
          console.warn("[DailyCall] Pre-join cleanup:", e)
        }
        callObjectRef.current = null
      }

      const res = await fetch("/api/daily/meeting", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, callMode, userRole }),
      })
      const data = (await res.json()) as { url?: string; token?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "API-Fehler")
      const { url, token } = data
      if (!url || !token) throw new Error("Keine URL oder Token erhalten.")
      joinCredentialsRef.current = { url, token }

      if (!token) {
        console.error("CRITICAL: No token provided to join!")
        setError("CRITICAL: No token provided to join!")
        setPhase("LOBBY")
        return
      }

      console.log("--- JOIN ATTEMPT ---")
      console.log("URL:", url)
      console.log("TOKEN-PREFIX:", token?.substring(0, 20))
      console.log("Token Length:", token.length)
      joinUrlRef.current = url

      const call = Daily.createCallObject({ subscribeToTracksAutomatically: true })
      callObjectRef.current = call

      await call.join({
        url,
        token: token,
        videoSource: selectedCameraId || true,
        audioSource: selectedMicId || true,
        startVideoOff: callMode === "voice",
      })
      setPhase("IN_CALL")

      // start-session: Mark booking as active (idempotent; 5-min window enforced by API)
      try {
        const patchRes = await fetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start-session" }),
        })
        const patchData = (await patchRes.json()) as { error?: string; sessionStartedAt?: string }
        if (!patchRes.ok) {
          if (patchRes.status === 425) {
            await call.leave()
            call.destroy()
            callObjectRef.current = null
            setPhase("LOBBY")
            setError(patchData.error ?? "Raum öffnet erst 5 Minuten vor dem Termin.")
            return
          }
          console.warn("[DailyCall] start-session failed:", patchData.error)
        } else {
          if (patchData?.sessionStartedAt) {
            serverSessionStartMsRef.current = new Date(patchData.sessionStartedAt).getTime()
          }
          onSessionStarted?.()
        }
      } catch (startErr) {
        console.warn("[DailyCall] start-session error:", startErr)
      }
    } catch (e) {
      const retryIndex = joinRetryCountRef.current
      if (retryIndex < MAX_JOIN_RETRIES) {
        joinRetryCountRef.current = retryIndex + 1
        const delay = JOIN_RETRY_DELAYS_MS[retryIndex] ?? 2500
        joinRetryTimeoutRef.current = setTimeout(() => {
          joinRetryTimeoutRef.current = null
          handleJoinRef.current?.(true)
        }, delay)
      } else {
        joinRetryCountRef.current = 0
        setError(e instanceof Error ? e.message : String(e))
        setPhase("LOBBY")
      }
    }
  }, [phase, bookingId, callMode, userRole, selectedCameraId, selectedMicId, onSessionStarted, t])

  useEffect(() => {
    handleJoinRef.current = handleJoin
  }, [handleJoin])

  // --- IN_CALL: Events ---
  useEffect(() => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL") return
    initGuardRef.current = true

    const syncRemoteParticipant = () => {
      const participants = call.participants()
      const localSessionId = participants?.local?.session_id
      for (const [, p] of Object.entries(participants ?? {})) {
        if (p.session_id !== localSessionId) {
          const tracks = (p as { tracks?: { video?: { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }; audio?: { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack } } })?.tracks
          const videoTrack = tracks?.video?.persistentTrack ?? tracks?.video?.track
          const audioTrack = tracks?.audio?.persistentTrack ?? tracks?.audio?.track
          const pTyped = p as { user_name?: string; audio?: boolean }
          remoteSessionIdRef.current = p.session_id
          setRemoteParticipant({
            sessionId: p.session_id,
            userName: pTyped.user_name,
            hasVideo: !!videoTrack,
            hasAudio: !!audioTrack,
            audioTrack: audioTrack ?? undefined,
          })
          return true
        }
      }
      return false
    }

    const handleJoinedMeeting = () => {
      const participants = call.participants()
      console.log("participants.local (vollständig):", participants?.local)
      const currentRoom =
        (participants?.local as { room_name?: string } | undefined)?.room_name ||
        joinUrlRef.current?.split("/").pop() ||
        "(unbekannt)"
      console.log("INTERNER RAUM-NAME:", currentRoom)
      if (serverSessionStartMsRef.current == null) {
        sessionStartMsRef.current = Date.now()
      } else {
        sessionStartMsRef.current = serverSessionStartMsRef.current
      }

      const tick = () => {
        if (useBillingTimer && sessionStartMsRef.current) {
          const balance = balanceCentsRef.current ?? userBalanceCents
          const remaining = calculateRemainingTime(
            sessionStartMsRef.current,
            hasPaidBefore,
            balance,
            pricePerMinuteCents,
            frozenDurationMsRef.current
          )
          setTimerSecondsLeft(remaining)
          if (remaining <= 60 && remaining > 0 && !lowBalanceWarningShownRef.current) {
            lowBalanceWarningShownRef.current = true
            toast.warning(t("toast.balanceLow"))
          }
          if (remaining <= 0) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
            frozenAtMsRef.current = Date.now()
            setIsFrozen(true)
            try {
              call.setLocalVideo(false)
              call.setLocalAudio(false)
            } catch (e) {
              console.warn("[DailyCall] setLocalVideo/Audio off:", e)
            }
            fetch(`/api/bookings/${bookingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "set-shugyo-frozen" }),
            }).catch(() => {})
          }
        } else {
          setTimerSecondsLeft((prev) => {
            if (prev === null) return TIMER_DURATION_SEC
            if (prev === 60 && !haptic4MinFiredRef.current) {
              haptic4MinFiredRef.current = true
              hapticMedium()
            }
            if (prev <= 1) {
              if (!haptic5MinFiredRef.current) {
                haptic5MinFiredRef.current = true
                hapticHeavy()
              }
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
              return 0
            }
            return prev - 1
          })
        }
      }
      const startMs = sessionStartMsRef.current ?? Date.now()
      const elapsedSec = (Date.now() - startMs) / 1000
      const initialRemaining = useBillingTimer
        ? calculateRemainingTime(startMs, hasPaidBefore, balanceCentsRef.current ?? userBalanceCents, pricePerMinuteCents, frozenDurationMsRef.current)
        : Math.max(0, Math.round(TIMER_DURATION_SEC - elapsedSec))
      setTimerSecondsLeft(initialRemaining)
      tick()
      timerIntervalRef.current = setInterval(tick, 1000)
      syncRemoteParticipant()
    }

    const handleParticipantJoined = (ev: { participant?: { session_id?: string; user_name?: string } }) => {
      console.log("PARTICIPANT DETECTED:", ev?.participant?.session_id)
      const p = ev?.participant
      if (p?.session_id && p.session_id !== call.participants()?.local?.session_id) {
        remoteSessionIdRef.current = p.session_id
        const part = call.participants()[p.session_id] as { tracks?: { video?: { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }; audio?: { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack } }; user_name?: string; audio?: boolean } | undefined
        const videoTrack = part?.tracks?.video?.persistentTrack ?? part?.tracks?.video?.track
        const audioTrack = part?.tracks?.audio?.persistentTrack ?? part?.tracks?.audio?.track
        console.log("Partner Audio State:", part?.audio)
        setRemoteParticipant({
          sessionId: p.session_id,
          userName: p.user_name,
          hasVideo: !!videoTrack,
          hasAudio: !!audioTrack,
          audioTrack: audioTrack ?? undefined,
        })
      }
    }

    const handleParticipantUpdated = (ev: { participant?: { session_id?: string } }) => {
      const p = ev.participant
      if (!p?.session_id || p.session_id === call.participants()?.local?.session_id) return
      const part = call.participants()[p.session_id] as {
        tracks?: {
          video?: { state?: string; persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }
          audio?: { state?: string; persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }
        }
        audio?: boolean
      } | undefined
      const videoTrackObj = part?.tracks?.video
      const audioTrackObj = part?.tracks?.audio
      const videoTrack = videoTrackObj?.persistentTrack ?? videoTrackObj?.track
      const audioTrack = audioTrackObj?.persistentTrack ?? audioTrackObj?.track
      const isVideoPlayable = videoTrackObj?.state === "playable"

      if (p.session_id === remoteSessionIdRef.current) {
        console.log("Partner Audio State:", part?.audio)

        if (isVideoPlayable && remoteVideoRef.current) {
          const tracks: MediaStreamTrack[] = []
          if (videoTrack) tracks.push(videoTrack)
          if (audioTrack) tracks.push(audioTrack)
          if (tracks.length > 0) {
            remoteVideoRef.current.srcObject = new MediaStream(tracks)
            remoteVideoRef.current.play().catch(() => {})
          }
        }

        if (audioTrack && remoteAudioRef.current && callMode === "voice") {
          remoteAudioRef.current.srcObject = new MediaStream([audioTrack])
          remoteAudioRef.current.play().catch((e) => console.error("Audio Play Error:", e))
        }
      }

      setRemoteParticipant((prev) => {
        if (!prev || prev.sessionId !== p.session_id) return prev
        return {
          ...prev,
          sessionId: prev.sessionId,
          hasVideo: !!videoTrack,
          hasAudio: !!audioTrack,
          audioTrack: audioTrack ?? undefined,
        }
      })
    }

    const handleParticipantLeft = (ev: { participant?: { session_id?: string } }) => {
      if (ev.participant?.session_id === remoteSessionIdRef.current) {
        remoteSessionIdRef.current = null
        setRemoteParticipant(null)
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = null
          remoteAudioRef.current.pause()
        }
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
      if (ev.participant?.session_id !== remoteSessionIdRef.current) return
      const t = ev.track as MediaStreamTrack | { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }
      const mediaTrack = t instanceof MediaStreamTrack ? t : t?.persistentTrack ?? t?.track
      if (!mediaTrack) return
      if (ev.track?.kind === "video" && remoteVideoRef.current) {
        const part = call.participants()[ev.participant.session_id] as { tracks?: { video?: { track?: MediaStreamTrack }; audio?: { track?: MediaStreamTrack } } } | undefined
        const videoTrack = mediaTrack
        const audioTrack = part?.tracks?.audio?.track ?? (part as { tracks?: { audio?: { persistentTrack?: MediaStreamTrack } } })?.tracks?.audio?.persistentTrack
        const tracks: MediaStreamTrack[] = [videoTrack]
        if (audioTrack) tracks.push(audioTrack)
        remoteVideoRef.current.srcObject = new MediaStream(tracks)
        remoteVideoRef.current.play().catch(() => {})
        setRemoteParticipant((prev) => prev ? { ...prev, sessionId: prev.sessionId, hasVideo: true } : prev)
      }
      if (ev.track?.kind === "audio") {
        if (callMode === "voice" && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = new MediaStream([mediaTrack])
          remoteAudioRef.current.play().catch((e) => console.error("Audio Play Error:", e))
        }
        if (callMode === "video" && remoteVideoRef.current) {
          const part = call.participants()[ev.participant.session_id] as { tracks?: { video?: { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }; audio?: { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack } } } | undefined
          const vidTrack = part?.tracks?.video?.persistentTrack ?? part?.tracks?.video?.track
          const tracks: MediaStreamTrack[] = []
          if (vidTrack) tracks.push(vidTrack)
          tracks.push(mediaTrack)
          remoteVideoRef.current.srcObject = new MediaStream(tracks)
          remoteVideoRef.current.play().catch(() => {})
        }
        setRemoteParticipant((prev) => prev ? { ...prev, sessionId: prev.sessionId, hasAudio: true, audioTrack: mediaTrack } : prev)
      }
    }

    const handleError = (err: unknown) => {
      console.error("[DailyCall] DAILY ERROR:", err)
      setReconnectState((prev) => (prev ? prev : { phase: "waiting", secondsLeft: 60 }))
    }

    const handleCameraError = () => {
      setReconnectState((prev) => (prev ? prev : { phase: "waiting", secondsLeft: 60 }))
    }

    const handleNetworkConnection = (ev: { action?: string; type?: string; event?: string }) => {
      const isInterrupted =
        ev?.action === "interrupted" ||
        ev?.event === "interrupted" ||
        (ev as { payload?: { action?: string } })?.payload?.action === "interrupted"
      if (isInterrupted) {
        setReconnectState((prev) => (prev ? prev : { phase: "waiting", secondsLeft: 60 }))
      }
    }

    call.on("error", handleError)
    call.on("camera-error", handleCameraError)
    call.on("network-connection", handleNetworkConnection)
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
      setIsCameraOff(false)
      initGuardRef.current = false
    })

    call.startRemoteParticipantsAudioLevelObserver?.(200)

    if (call.meetingState() === "joined-meeting") handleJoinedMeeting()

    syncRemoteParticipant()
    const participantsRefreshInterval = setInterval(() => {
      if (remoteSessionIdRef.current) return
      if (call.meetingState() !== "joined-meeting") return
      syncRemoteParticipant()
    }, 500)

    return () => {
      clearInterval(participantsRefreshInterval)
      call.off("error", handleError)
      call.off("camera-error", handleCameraError)
      call.off("network-connection", handleNetworkConnection)
      call.off("joined-meeting", handleJoinedMeeting)
      call.off("participant-joined", handleParticipantJoined)
      call.off("participant-updated", handleParticipantUpdated)
      call.off("participant-left", handleParticipantLeft)
      call.off("remote-participants-audio-level", handleRemoteAudioLevel)
      call.off("track-started", handleTrackStarted)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [phase, callMode, useBillingTimer, hasPaidBefore, userBalanceCents, pricePerMinuteCents, bookingId, t])

  // --- App State: Background → local notification; Foreground → cancel notification ---
  useEffect(() => {
    if (phase !== "IN_CALL") return
    import("@capacitor/app")
      .then(({ App }) => App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) cancelSessionActiveNotification()
        else scheduleSessionActiveNotification()
      }))
      .then((l) => {
        appStateRemoveRef.current = () => l.remove()
      })
      .catch(() => {})
    return () => {
      appStateRemoveRef.current?.()
      appStateRemoveRef.current = null
    }
  }, [phase])

  // --- Graceful Reconnect: 60s countdown (boolean-Dep bleibt während Countdown true → Interval wird nicht jede Sek. neu gestartet)
  const reconnectCountdownActive = reconnectState != null && reconnectState.secondsLeft > 0
  useEffect(() => {
    if (!reconnectCountdownActive) return
    const id = setInterval(() => {
      setReconnectState((prev) => {
        if (!prev || prev.secondsLeft <= 1) return null
        return { phase: "waiting", secondsLeft: prev.secondsLeft - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [reconnectCountdownActive])

  useEffect(() => {
    if (!reconnectState || phase !== "IN_CALL") return
    let cancelled = false
    const tryRejoin = async () => {
      const call = callObjectRef.current
      if (!call || cancelled) return
      try {
        const { checkConnectivity } = await import("@/lib/native-utils")
        const { connected } = await checkConnectivity()
        if (!connected || cancelled) return
        const res = await fetch("/api/daily/meeting", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, callMode, userRole }),
        })
        const data = (await res.json()) as { url?: string; token?: string; error?: string }
        if (!res.ok || !data.url || !data.token || cancelled) return
        joinCredentialsRef.current = { url: data.url, token: data.token }
        setReconnectState(null)
        await call.join({
          url: data.url,
          token: data.token,
          videoSource: selectedCameraId || true,
          audioSource: selectedMicId || true,
          startVideoOff: callMode === "voice",
        })
      } catch (e) {
        console.warn("[DailyCall] Reconnect join failed:", e)
      }
    }
    const poll = async () => {
      if (cancelled) return
      const { checkConnectivity } = await import("@/lib/native-utils")
      const { connected } = await checkConnectivity()
      if (connected) tryRejoin()
    }
    poll()
    const id = setInterval(poll, 3000)
    let removeNetworkListener: (() => void) | undefined
    import("@capacitor/network")
      .then(({ Network }) => Network.addListener("networkStatusChange", (s) => s.connected && tryRejoin()))
      .then((l) => {
        removeNetworkListener = () => l.remove()
      })
      .catch(() => {})
    return () => {
      cancelled = true
      clearInterval(id)
      removeNetworkListener?.()
    }
  }, [reconnectState, phase, bookingId, callMode, userRole, selectedCameraId, selectedMicId])

  // --- Paket 4: Shugyo Freeze – Balance-Polling, Resume, 5-Min-Timeout ---
  const forceEndFromFreeze = useCallback(async () => {
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end-session" }),
      })
    } catch {
      /* ignore */
    }
    performCleanup()
    onCallEnded?.()
  }, [bookingId, performCleanup, onCallEnded])

  useEffect(() => {
    if (!isFrozen || userRole !== "shugyo" || phase !== "IN_CALL") return
    const call = callObjectRef.current
    const minBalanceCents = pricePerMinuteCents * 5
    const FREEZE_TIMEOUT_MS = 5 * 60 * 1000

    const poll = async () => {
      const frozenAt = frozenAtMsRef.current
      if (frozenAt && Date.now() - frozenAt > FREEZE_TIMEOUT_MS) {
        forceEndFromFreeze()
        return
      }
      try {
        const res = await fetch("/api/user/balance", { credentials: "include" })
        const data = (await res.json()) as { balanceCents?: number }
        const balance = data.balanceCents ?? 0
        if (balance >= minBalanceCents && call) {
          if (frozenAtMsRef.current) {
            frozenDurationMsRef.current += Date.now() - frozenAtMsRef.current
            frozenAtMsRef.current = null
          }
          balanceCentsRef.current = balance
          setBalanceCentsForTimer(balance)
          setIsFrozen(false)
          try {
            call.setLocalVideo(callMode === "video")
            call.setLocalAudio(true)
          } catch (e) {
            console.warn("[DailyCall] setLocalVideo/Audio on:", e)
          }
          await fetch(`/api/bookings/${bookingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clear-shugyo-frozen" }),
          })
        }
      } catch {
        /* ignore */
      }
    }

    poll()
    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [isFrozen, userRole, phase, callMode, bookingId, pricePerMinuteCents, forceEndFromFreeze])

  // Paket 4: Timer neu starten nach Resume (Shugyo hatte 0 Guthaben, hat aufgeladen)
  useEffect(() => {
    if (isFrozen || !useBillingTimer || phase !== "IN_CALL" || !sessionStartMsRef.current || balanceCentsForTimer === null) return

    const tick = () => {
      const balance = balanceCentsRef.current ?? userBalanceCents
      const remaining = calculateRemainingTime(
        sessionStartMsRef.current!,
        hasPaidBefore,
        balance,
        pricePerMinuteCents,
        frozenDurationMsRef.current
      )
      setTimerSecondsLeft(remaining)
      if (remaining <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
        frozenAtMsRef.current = Date.now()
        setIsFrozen(true)
        const call = callObjectRef.current
        if (call) {
          try {
            call.setLocalVideo(false)
            call.setLocalAudio(false)
          } catch (e) {
            console.warn("[DailyCall] setLocalVideo/Audio off:", e)
          }
        }
        fetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set-shugyo-frozen" }),
        }).catch(() => {})
      }
    }

    tick()
    timerIntervalRef.current = setInterval(tick, 1000)
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [isFrozen, useBillingTimer, phase, bookingId, hasPaidBefore, userBalanceCents, pricePerMinuteCents, balanceCentsForTimer])

  // --- Paket 4: Takumi – Poll für isShugyoFrozen, Session-Status ---
  useEffect(() => {
    if (userRole !== "takumi" || bookingMode !== "instant" || phase !== "IN_CALL") return

    const poll = async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" })
        if (!res.ok) return
        const data = (await res.json()) as { booking?: { isShugyoFrozen?: boolean; status?: string } }
        if (data.booking?.isShugyoFrozen) setIsShugyoFrozen(true)
        else setIsShugyoFrozen(false)
        if (data.booking?.status === "completed") {
          performCleanup()
          onCallEnded?.()
        }
      } catch {
        /* ignore */
      }
    }

    poll()
    const timer = setInterval(poll, 3000)
    return () => clearInterval(timer)
  }, [userRole, bookingMode, phase, bookingId, performCleanup, onCallEnded])

  // --- Zuweisung: Remote-Video+Audio-Tracks → remoteVideoRef / remoteAudioRef ---
  const assignRemoteVideoTrack = useCallback(() => {
    const call = callObjectRef.current
    const videoEl = remoteVideoRef.current
    const audioEl = remoteAudioRef.current
    if (!call || !remoteParticipant || phase !== "IN_CALL") return
    const participant = call.participants()[remoteParticipant.sessionId] as
      | {
          tracks?: {
            video?: { state?: string; persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }
            audio?: { state?: string; persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack }
          }
        }
      | undefined
    const videoTrackObj = participant?.tracks?.video
    const audioTrackObj = participant?.tracks?.audio
    const videoTrack = videoTrackObj?.persistentTrack ?? videoTrackObj?.track
    const audioTrack = audioTrackObj?.persistentTrack ?? audioTrackObj?.track

    if (videoEl && callMode === "video" && videoTrack) {
      const tracks: MediaStreamTrack[] = [videoTrack]
      if (audioTrack) tracks.push(audioTrack)
      videoEl.srcObject = new MediaStream(tracks)
      videoEl.play().catch(() => {})
    }

    if (audioTrack && audioEl && callMode === "voice") {
      audioEl.srcObject = new MediaStream([audioTrack])
      audioEl.play().catch((e) => console.error("Audio Play Error:", e))
    }
  }, [phase, callMode, remoteParticipant])

  // --- Video+Audio-Mapping useEffect: reagiert auf remoteParticipant + tracks ---
  useEffect(() => {
    const call = callObjectRef.current
    const videoEl = remoteVideoRef.current
    if (!call || phase !== "IN_CALL") return
    if (!remoteParticipant) {
      if (videoEl) videoEl.srcObject = null
      return
    }
    const participant = call.participants()[remoteParticipant.sessionId]
    console.log("[DailyCall] Tracks von Partner:", participant?.tracks)
    console.log("Partner Audio State:", (participant as { audio?: boolean })?.audio)
    assignRemoteVideoTrack()
    return () => {
      if (videoEl) videoEl.srcObject = null
    }
  }, [phase, callMode, remoteParticipant, assignRemoteVideoTrack])

  // --- Warnung: remoteParticipant fehlt (sofort prüfen, kein Timeout) ---
  useEffect(() => {
    if (phase !== "IN_CALL" || remoteParticipant) {
      setShowPartnerSearchWarning(false)
      return
    }
    setShowPartnerSearchWarning(true)
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
    const nextMuted = !isMuted
    try {
      call.setLocalAudio(!nextMuted)
      setIsMuted(nextMuted)
    } catch (e) {
      console.warn("[DailyCall] setLocalAudio failed:", e)
      setIsMuted(nextMuted)
    }
  }, [phase, isMuted])

  const handleToggleCamera = useCallback(() => {
    const call = callObjectRef.current
    if (!call || phase !== "IN_CALL" || callMode !== "video") return
    const nextOff = !isCameraOff
    try {
      call.setLocalVideo(!nextOff)
      setIsCameraOff(nextOff)
    } catch (e) {
      console.warn("[DailyCall] setLocalVideo failed:", e)
      setIsCameraOff(nextOff)
    }
  }, [phase, callMode, isCameraOff])

  const handleTogglePiP = useCallback(async () => {
    const videoEl = remoteVideoRef.current
    if (!videoEl || phase !== "IN_CALL" || callMode !== "video") return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        setIsPiPActive(false)
      } else if (videoEl.srcObject && "requestPictureInPicture" in videoEl) {
        await videoEl.requestPictureInPicture()
        setIsPiPActive(true)
      }
    } catch (e) {
      console.warn("[DailyCall] PiP failed:", e)
      setIsPiPActive(false)
    }
  }, [phase, callMode])

  useEffect(() => {
    const videoEl = remoteVideoRef.current
    if (!videoEl) return
    const onLeave = () => setIsPiPActive(false)
    videoEl.addEventListener("leavepictureinpicture", onLeave)
    return () => videoEl.removeEventListener("leavepictureinpicture", onLeave)
  }, [phase])

  // --- Background-Moderation: Alle 30s Snapshot → Vision API SafeSearch ---
  const getImageBase64 = useCallback(async (): Promise<string | null> => {
    const remoteEl = remoteVideoRef.current
    const localEl = localPiPVideoRef.current
    const videoEl = remoteEl?.srcObject && remoteEl.readyState >= 2
      ? remoteEl
      : localEl?.srcObject && localEl.readyState >= 2
        ? localEl
        : null
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return null
    try {
      const canvas = document.createElement("canvas")
      const w = Math.min(videoEl.videoWidth, 640)
      const h = Math.round((w / videoEl.videoWidth) * videoEl.videoHeight)
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(videoEl, 0, 0, w, h)
      return canvas.toDataURL("image/jpeg", 0.7)
    } catch {
      return null
    }
  }, [])

  const handleModerationViolation = useCallback(() => {
    toast.error("Verbindung getrennt: Verstoß gegen die Community-Richtlinien erkannt.", { duration: 6000 })
    performCleanup()
    if (onCallEnded) onCallEnded()
    else redirectToSessions("safety-violation")
  }, [performCleanup, onCallEnded, redirectToSessions])

  useSafeSnapshot({
    bookingId,
    getImageBase64,
    onViolation: handleModerationViolation,
    intervalMs: 30_000,
    enabled: phase === "IN_CALL" && callMode === "video" && !!safetyAccepted,
  })

  // --- Cleanup NUR bei echtem Unmount (nicht bei Re-Render/Strict Mode Remount) ---
  useEffect(() => {
    return () => {
      console.log("[DailyCall] Cleanup: Komponente unmountet – performCleanup (KEIN Redirect)")
      cancelSessionActiveNotification()
      performCleanup()
    }
  }, [performCleanup])

  // --- App Shell (unzerstörbare Struktur) ---
  const shellClass =
    "fixed inset-0 h-[100dvh] w-full flex flex-col bg-background overflow-hidden pt-[env(safe-area-inset-top,0px)]"

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
        {/* Pre-Call Safety Modal (nur Video) */}
        <Dialog open={needsSafetyModal && !safetyAccepted}>
          <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>diaiway Safety Enforcement</DialogTitle>
              <DialogDescription>
                Bevor du dem Video-Call beitrittst, bestätige bitte:
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={safetyCheck1} onCheckedChange={(v) => setSafetyCheck1(!!v)} className="mt-0.5" />
                <span>Ich werde keine verbotenen Inhalte zeigen oder teilen.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={safetyCheck2} onCheckedChange={(v) => setSafetyCheck2(!!v)} className="mt-0.5" />
                <span>Ich bin mir der Nutzungsbedingungen bewusst.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={safetyCheck3} onCheckedChange={(v) => setSafetyCheck3(!!v)} className="mt-0.5" />
                <span>Ich respektiere die Sicherheitsrichtlinien. Bei Verdacht können Stichproben geprüft werden.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={safetyCheck4} onCheckedChange={(v) => setSafetyCheck4(!!v)} className="mt-0.5" />
                <span>Ich bin über die Belehrung zu sexualisierten oder gewalttätigen Inhalten informiert und verpflichte mich, diese nicht zu zeigen.</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={safetyCheck5} onCheckedChange={(v) => setSafetyCheck5(!!v)} className="mt-0.5" />
                <span>Ich willige ein, dass Video-Stichproben zur Sicherheitsprüfung automatisch analysiert werden können (Vision API).</span>
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <Square className="size-5 shrink-0 fill-destructive text-destructive" />
                <span className="text-xs text-foreground">
                  Der rote Notfall-Button (⏹) im Call unterbricht sofort das Gespräch und meldet den Call. Nutze ihn bei Problemen.
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSafetyConfirm}
                disabled={!safetyCheck1 || !safetyCheck2 || !safetyCheck3 || !safetyCheck4 || !safetyCheck5 || safetySubmitting}
              >
                {safetySubmitting ? "…" : "Ich bestätige"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
            {callMode === "video" && preCheckError && (
              <p className="text-sm text-destructive">{preCheckError}</p>
            )}
            <Button
              onClick={() => handleJoin()}
              disabled={!canJoin || preCheckLoading}
              className="h-12 gap-2"
            >
              {preCheckLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sicherheitsprüfung...
                </>
              ) : (
                "Beitreten"
              )}
            </Button>
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
    secs > 120 ? "text-emerald-400" : secs > 60 ? "text-amber-400" : "text-red-400"
  const timerBlink = secs > 0 && secs <= (useBillingTimer ? 60 : 30)

  const hasRemoteVideo =
    callMode === "video" && remoteParticipant?.hasVideo
  const showVideoFallback = callMode === "video" && !hasRemoteVideo

  return (
    <div className={shellClass}>
      {/* Verstecktes Audio-Element für Remote-Ton (Video + Voice) */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" aria-hidden />

      {/* Video-Bereich (Top): flex-1 relative bg-black */}
      <div className="relative flex-1 bg-black">
        {callMode === "video" ? (
          <>
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

        {/* Paket 4: Shugyo Freeze-Overlay – Guthaben aufgebraucht */}
        {isFrozen && userRole === "shugyo" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
              <Wallet className="size-12 text-amber-500" />
              <div>
                <h3 className="text-lg font-bold text-foreground">Dein Guthaben ist aufgebraucht</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lade dein Wallet auf, um das Gespräch fortzusetzen.
                </p>
              </div>
              <Button
                onClick={() => openWalletTopup(() => {})}
                className="w-full gap-2 rounded-xl bg-primary font-semibold"
              >
                <Wallet className="size-4" />
                Wallet aufladen
              </Button>
            </div>
          </div>
        )}

        {/* Paket 4: Takumi-Overlay – Shugyo lädt auf */}
        {isShugyoFrozen && userRole === "takumi" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 rounded-xl border border-border bg-card/95 px-6 py-4 text-center shadow-lg">
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="mt-2 text-sm font-medium text-foreground">
                Dein Partner lädt gerade sein Guthaben auf.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Bitte warte einen Moment…
              </p>
            </div>
          </div>
        )}

        {reconnectState && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
            <Loader2 className="size-12 animate-spin text-primary" />
            <p className="text-center text-base font-medium text-white">
              Verbindung unterbrochen. Verbinde neu…
            </p>
            <p className="text-sm text-white/80">
              {reconnectState.secondsLeft > 0
                ? `Automatischer Versuch in ${reconnectState.secondsLeft}s`
                : "Warte auf Netzwerkverbindung…"}
            </p>
            <p className="text-xs text-white/60">
              Der 5-Min-Timer läuft weiter – keine doppelte Abrechnung.
            </p>
          </div>
        )}

        {showPartnerSearchWarning && !reconnectState && (
          <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-medium text-black">
            Suche Partner im Raum…
          </div>
        )}
        {timerSecondsLeft !== null && !isFrozen && (
          <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 sm:left-4 sm:top-4">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-sm font-medium tabular-nums backdrop-blur-sm sm:px-3 sm:py-1.5",
                timerColorClass,
                timerBlink && "animate-timer-blink"
              )}
            >
              {useBillingTimer && <Wallet className="size-3.5 shrink-0 opacity-80" />}
              <span>{formatMmSs(secs)}</span>
            </div>
            {useBillingTimer && (
              <span className="text-[10px] text-white/70">30 Sek. kostenlos</span>
            )}
          </div>
        )}

        {/* Paket 4: Shugyo Freeze-Overlay */}
        {isFrozen && userRole === "shugyo" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-md p-6">
            <p className="text-center text-lg font-medium text-white">
              Dein Guthaben ist aufgebraucht. Lade dein Wallet auf, um das Gespräch fortzusetzen.
            </p>
            <Button
              onClick={() => openWalletTopup()}
              className="h-12 gap-2 rounded-xl bg-primary px-6 text-base font-semibold"
            >
              <Wallet className="size-5" />
              Wallet aufladen
            </Button>
          </div>
        )}

        {/* Paket 4: Takumi-Overlay wenn Shugyo eingefroren */}
        {isShugyoFrozen && userRole === "takumi" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
            <p className="text-center text-base font-medium text-white">
              Dein Partner lädt gerade sein Guthaben auf. Bitte warte einen Moment…
            </p>
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
          "pb-[env(safe-area-inset-bottom,0px)]"
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
          <>
            <Button
              variant={isCameraOff ? "destructive" : "outline"}
              size="icon"
              className="size-10 sm:size-12 transition-transform active:scale-95"
              onClick={handleToggleCamera}
              title={isCameraOff ? "Kamera an" : "Kamera aus"}
              aria-label={isCameraOff ? "Kamera an" : "Kamera aus"}
            >
              {isCameraOff ? <VideoOff className="size-5 sm:size-6" /> : <Video className="size-5 sm:size-6" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-10 sm:size-12 transition-transform active:scale-95"
              onClick={handleCycleCamera}
              title="Kamera wechseln (Front/Rück)"
              aria-label="Kamera wechseln"
            >
              <FlipHorizontal
                className="size-5 sm:size-6 transition-transform duration-300"
                style={{ transform: `rotate(${cameraFlipRotation}deg)` }}
              />
            </Button>
            {hasRemoteVideo && (
              <Button
                variant={isPiPActive ? "secondary" : "outline"}
                size="icon"
                className="size-10 sm:size-12 transition-transform active:scale-95"
                onClick={handleTogglePiP}
                title={isPiPActive ? "PiP beenden" : "Bild-in-Bild (in anderer App weiter sehen)"}
                aria-label={isPiPActive ? "PiP beenden" : "Bild-in-Bild"}
              >
                {isPiPActive ? <Maximize2 className="size-5 sm:size-6" /> : <PictureInPicture className="size-5 sm:size-6" />}
              </Button>
            )}
          </>
        )}

        <Button
          variant="destructive"
          size="icon"
          className="size-10 sm:size-12 transition-transform active:scale-95"
          onClick={handleAuflegen}
          title="Auflegen"
        >
          <PhoneOff className="size-5 sm:size-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 sm:size-10 shrink-0 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted/50 hover:text-muted-foreground"
          onClick={handleReportAndLeave}
          title="Notfall: Call melden (nur bei Problemen)"
          aria-label="Notfall: Call melden"
        >
          <Square className="size-4 sm:size-5" />
        </Button>
      </div>
    </div>
  )
}

"use client"

/**
 * useDailyCall — Custom-UI-Modus mit createCallObject.
 * cycleCamera({ preferDifferentFacingMode: true }) für mobile Front-/Back-Kamera.
 */

import { useState, useEffect, useCallback, useRef } from "react"

export type CallMode = "voice" | "video"

export type CameraFacing = "front" | "back" | "unknown"

export interface UseDailyCallOptions {
  roomUrl: string | null
  callMode: CallMode
}

export interface UseDailyCallReturn {
  isJoined: boolean
  isMuted: boolean
  isVideoOn: boolean
  isPartnerSpeaking: boolean
  currentCamera: CameraFacing
  error: Error | null
  localVideoTrack: MediaStreamTrack | null
  remoteVideoTrack: MediaStreamTrack | null
  join: () => Promise<void>
  leave: () => Promise<void>
  cycleCamera: () => Promise<void>
  toggleMute: () => void
  toggleVideo: () => void
  remoteParticipant: { sessionId: string; userName?: string } | null
}

export function useDailyCall({
  roomUrl,
  callMode,
}: UseDailyCallOptions): UseDailyCallReturn {
  const [isJoined, setIsJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(callMode === "video")
  const [isPartnerSpeaking, setIsPartnerSpeaking] = useState(false)
  const [currentCamera, setCurrentCamera] = useState<CameraFacing>("unknown")
  const [error, setError] = useState<Error | null>(null)
  const [remoteParticipant, setRemoteParticipant] = useState<{
    sessionId: string
    userName?: string
  } | null>(null)
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null)

  const callObjectRef = useRef<ReturnType<typeof import("@daily-co/daily-js").createCallObject> | null>(null)
  const mountedRef = useRef(true)

  const cycleCamera = useCallback(async () => {
    const call = callObjectRef.current
    if (!call || !isJoined) return
    try {
      await call.cycleCamera({ preferDifferentFacingMode: true })
      const settings = call.getInputSettings()
      const videoSettings = settings?.video
      if (videoSettings?.facingMode === "user") setCurrentCamera("front")
      else if (videoSettings?.facingMode === "environment") setCurrentCamera("back")
    } catch (err) {
      console.warn("[useDailyCall] cycleCamera:", err)
    }
  }, [isJoined])

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

  const join = useCallback(async () => {
    if (!roomUrl) return
    setError(null)
    let Daily: typeof import("@daily-co/daily-js").default
    try {
      Daily = (await import("@daily-co/daily-js")).default
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Daily nicht geladen"))
      return
    }

    const call = Daily.createCallObject({
      url: roomUrl,
      subscribeToTracksAutomatically: true,
      ...(callMode === "voice" ? { videoSource: false } : {}),
    })
    callObjectRef.current = call

    const updateTracks = () => {
      if (!mountedRef.current) return
      const parts = call.participants()
      const local = parts?.local
      const localTrack = (local?.tracks?.video as { persistentTrack?: MediaStreamTrack } | undefined)?.persistentTrack
      setLocalVideoTrack(localTrack ?? null)
      const remote = Object.entries(parts ?? {}).find(([_, p]) => !(p as { local?: boolean }).local)?.[1] as
        | { tracks?: { video?: { persistentTrack?: MediaStreamTrack } } }
        | undefined
      const remoteTrack = remote?.tracks?.video?.persistentTrack
      setRemoteVideoTrack(remoteTrack ?? null)
    }

    call.on("joined-meeting", () => {
      if (!mountedRef.current) return
      setIsJoined(true)
      const parts = call.participants()
      const local = parts?.local
      if (local?.tracks?.video?.state === "playable") setIsVideoOn(true)
      else if (callMode === "video") setIsVideoOn(false)
      updateTracks()
    })
    call.on("participant-updated", updateTracks)

    call.on("left-meeting", () => {
      if (!mountedRef.current) return
      setIsJoined(false)
      setRemoteParticipant(null)
      setLocalVideoTrack(null)
      setRemoteVideoTrack(null)
    })

    call.on("participant-joined", (ev: { participant: { session_id: string; user_name?: string; local?: boolean } }) => {
      if (!mountedRef.current || !ev.participant) return
      const p = ev.participant
      if (p.local) return
      setRemoteParticipant({ sessionId: p.session_id, userName: p.user_name })
    })

    call.on("participant-left", (ev: { participant?: { session_id?: string } }) => {
      if (!mountedRef.current) return
      const leftId = ev.participant?.session_id
      if (leftId) setRemoteParticipant((prev) => (prev?.sessionId === leftId ? null : prev))
    })

    call.on("active-speaker-change", (ev: { activeSpeaker: { peerId: string } }) => {
      if (!mountedRef.current) return
      const localId = call.participants()?.local?.session_id
      setIsPartnerSpeaking(!!ev.activeSpeaker?.peerId && ev.activeSpeaker.peerId !== localId)
    })

    call.on("error", (ev: { errorMsg?: string }) => {
      if (!mountedRef.current) return
      setError(new Error(ev?.errorMsg ?? "Verbindungsfehler"))
    })

    call.on("input-settings-updated", () => {
      if (!mountedRef.current) return
      const settings = call.getInputSettings()
      const facing = settings?.video?.facingMode
      if (facing === "user") setCurrentCamera("front")
      else if (facing === "environment") setCurrentCamera("back")
    })

    call.on("remote-participants-audio-level", (ev: { participants?: Record<string, { level?: number }> }) => {
      if (!mountedRef.current) return
      const levels = ev.participants ?? {}
      const speaking = Object.values(levels).some((p) => (p?.level ?? 0) > 0.02)
      setIsPartnerSpeaking(speaking)
    })

    try {
      await call.join()
      call.startRemoteParticipantsAudioLevelObserver(200)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      call.destroy()
      callObjectRef.current = null
    }
  }, [roomUrl, callMode])

  const leave = useCallback(async () => {
    const call = callObjectRef.current
    if (!call) return
    try {
      await call.leave()
    } finally {
      call.destroy()
      callObjectRef.current = null
      if (mountedRef.current) {
        setIsJoined(false)
        setRemoteParticipant(null)
        setIsPartnerSpeaking(false)
      }
    }
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

  return {
    isJoined,
    isMuted,
    isVideoOn,
    isPartnerSpeaking,
    currentCamera,
    error,
    localVideoTrack,
    remoteVideoTrack,
    join,
    leave,
    cycleCamera,
    toggleMute,
    toggleVideo,
    remoteParticipant,
  }
}

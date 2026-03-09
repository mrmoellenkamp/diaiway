"use client"

/**
 * DeviceSetup — Kamera- und Mikrofon-Auswahl im Precheck.
 * releaseTracks() muss VOR dem Join aufgerufen werden, damit Daily die Geräte nutzen kann.
 */

import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from "react"
import { useI18n } from "@/lib/i18n"
import { Video, Mic, AlertTriangle, Loader2 } from "lucide-react"

export interface DeviceSetupProps {
  mode: "video" | "voice"
  onReady?: (hasDevices: boolean) => void
}

export interface DeviceSetupRef {
  releaseTracks: () => void
}

interface DeviceInfo {
  deviceId: string
  label: string
}

export const DeviceSetup = forwardRef<DeviceSetupRef, DeviceSetupProps>(
  function DeviceSetup({ mode, onReady }, ref) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameras, setCameras] = useState<DeviceInfo[]>([])
  const [mics, setMics] = useState<DeviceInfo[]>([])
  const [selectedCam, setSelectedCam] = useState("")
  const [selectedMic, setSelectedMic] = useState("")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setErrorMsg("")

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          mode === "video" ? { video: true, audio: true } : { audio: true }
        )
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        setStream(stream)
        if (videoRef.current && mode === "video") {
          videoRef.current.srcObject = stream
        }

        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || t("precheck.cameraDefault", { n: i + 1 }) }))
        const audios = devices
          .filter((d) => d.kind === "audioinput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || t("precheck.micDefaultLabel", { n: i + 1 }) }))

        if (!cancelled) {
          setCameras(cams)
          setMics(audios)
          if (cams.length && !selectedCam) setSelectedCam(cams[0].deviceId)
          if (audios.length && !selectedMic) setSelectedMic(audios[0].deviceId)
          setStatus("ready")
          onReady?.(cams.length > 0 || audios.length > 0)
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error")
          setErrorMsg(err instanceof Error ? err.message : t("precheck.deviceError"))
          onReady?.(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [mode])

  useImperativeHandle(ref, () => ({
    releaseTracks: () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    },
  }), [])

  useEffect(() => {
    if (status !== "ready") return
    const needCam = mode === "video" && cameras.length > 0
    const needMic = mics.length > 0
    if ((needCam && !selectedCam) || (needMic && !selectedMic)) return
    let cancelled = false
    const applyDevices = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
          video: mode === "video" ? (selectedCam ? { deviceId: { exact: selectedCam } } : true) : false,
        }
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        setStream((prev) => {
          prev?.getTracks().forEach((t) => t.stop())
          streamRef.current = s
          return s
        })
        if (videoRef.current && mode === "video") {
          videoRef.current.srcObject = s
        }
      } catch {
        // Beim Gerätewechsel fehlgeschlagen — aktuellen Stream behalten
      }
    }
    applyDevices()
    return () => {
      cancelled = true
    }
  }, [selectedCam, selectedMic, mode, status, cameras.length, mics.length])

  useEffect(
    () => () => stream?.getTracks().forEach((t) => t.stop()),
    [stream]
  )

  if (status === "loading") {
    return (
      <div className="flex w-full items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-6">
        <Loader2 className="size-6 shrink-0 animate-spin text-primary" />
        <span className="text-sm text-foreground">{t("precheck.deviceLoading")}</span>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex w-full flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("precheck.deviceHint")}</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{t("precheck.deviceSetup")}</h3>

      {mode === "video" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Video className="size-4" />
            {t("precheck.cameraSelect")}
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          </div>
          {cameras.length > 1 && (
            <select
              value={selectedCam}
              onChange={(e) => setSelectedCam(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mic className="size-4" />
          {t("precheck.micSelect")}
        </div>
        {mics.length > 1 ? (
          <select
            value={selectedMic}
            onChange={(e) => setSelectedMic(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {mics.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-muted-foreground">{t("precheck.micDefault")}</p>
        )}
      </div>
    </div>
  )
})

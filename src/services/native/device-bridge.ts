"use client"

/**
 * Geräte-Bridge: Abstrahiert Web vs. native Plattform (Capacitor iOS/Android).
 * Ermöglicht plattform-spezifische Logik ohne die Webapp zu beeinträchtigen.
 */

import { Capacitor } from "@capacitor/core"

/** Läuft die App in einer nativen Capacitor-Umgebung (iOS/Android)? */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false
  return Capacitor.isNativePlatform()
}

/** Läuft die App im Browser (Web)? */
export function isWebPlatform(): boolean {
  return !isNativePlatform()
}

/**
 * Fordert Kamera- und Mikrofon-Stream für Video/Voice-Calls an (Shugyo/Takumi).
 * Web: Standard navigator.mediaDevices.getUserMedia
 * Native: Nutzt dieselbe API (WebView unterstützt getUserMedia).
 * Hinweis: Bei nativer Nutzung @capacitor/camera für Foto-Capture optional ergänzen.
 */
export async function getMediaStream(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
  if (typeof navigator?.mediaDevices?.getUserMedia !== "function") {
    throw new Error("getUserMedia wird in dieser Umgebung nicht unterstützt.")
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}

/**
 * Prüft den Mikrofon-Permission-Status.
 * Web: navigator.permissions.query (falls unterstützt) oder direkt getUserMedia.
 * Native: Dieselbe API, WebView reicht Permissions durch.
 */
export async function getMicrophonePermissionState(): Promise<PermissionState | "unsupported"> {
  if (typeof navigator?.permissions?.query !== "function") return "unsupported"
  try {
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
    return result.state as PermissionState
  } catch {
    return "unsupported"
  }
}

/**
 * Fordert explizit Mikrofon-Permission an (z.B. vor Video-Call).
 * Ruft intern getMediaStream mit nur Audio auf und gibt den Stream frei.
 */
export async function requestMicrophoneAccess(): Promise<boolean> {
  try {
    const stream = await getMediaStream({ video: false, audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

/**
 * Fordert explizit Kamera-Permission an (z.B. vor Video-Call).
 * Ruft intern getMediaStream mit nur Video auf und gibt den Stream frei.
 */
export async function requestCameraAccess(): Promise<boolean> {
  try {
    const stream = await getMediaStream({ video: true, audio: false })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

/**
 * Nimmt ein Foto mit der Kamera auf (nur für native Plattform vorbereitet).
 * Web: Nutzt getUserMedia + Canvas oder input[type=file].
 * Native: Hier könnte später @capacitor/camera eingebunden werden.
 * Aktuell: Fallback auf Standard-Web-API (getUserMedia + Video-Capture).
 */
export async function capturePhoto(): Promise<string | null> {
  if (isNativePlatform()) {
    // Native: Vorbereitet für @capacitor/camera – bei Bedarf:
    // const { Camera } = await import('@capacitor/camera')
    // const photo = await Camera.getPhoto({ resultType: CameraResultType.DataUrl, ... })
    // return photo.dataUrl
    // Aktuell: Web-API als Fallback (funktioniert in WebView)
  }

  try {
    const stream = await getMediaStream({ video: { facingMode: "user" }, audio: false })
    const video = document.createElement("video")
    video.srcObject = stream
    video.play()
    await new Promise<void>((resolve) => { video.onloadeddata = () => resolve() })
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    stream.getTracks().forEach((t) => t.stop())
    return canvas.toDataURL("image/jpeg", 0.9)
  } catch {
    return null
  }
}

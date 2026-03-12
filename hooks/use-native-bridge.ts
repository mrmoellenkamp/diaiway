"use client"

import { useCallback } from "react"
import { Capacitor } from "@capacitor/core"

/** Zentrale Abstraktion für native Features. Alle Funktionen sind nur in der App aktiv, im Web werden Fehler geworfen oder null zurückgegeben. */

function requireNative(): void {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Nur in der nativen App verfügbar.")
  }
}

/**
 * Biometrie: Face ID / Fingerprint verifizieren
 */
export async function verifyBiometric(reason = "Zur sicheren Authentifizierung"): Promise<boolean> {
  requireNative()
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric")
    const available = await NativeBiometric.isAvailable()
    if (!available.isAvailable) {
      throw new Error("Biometrie ist auf diesem Gerät nicht verfügbar.")
    }
    await NativeBiometric.verifyIdentity({
      reason,
      title: "Authentifizierung",
      subtitle: "Bestätige deine Identität",
    })
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("cancel") || msg.includes("abort") || msg.includes("User")) return false
    throw err
  }
}

/**
 * Biometrie: Verfügbarkeit prüfen
 */
export async function checkBiometricAvailable(): Promise<{ available: boolean; type?: string }> {
  if (!Capacitor.isNativePlatform()) return { available: false }
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric")
    const r = await NativeBiometric.isAvailable()
    return { available: r.isAvailable, type: String(r.biometryType ?? "") }
  } catch {
    return { available: false }
  }
}

export interface TakePhotoOptions {
  quality?: number
}

/**
 * Kamera: Foto aufnehmen
 * @returns Data-URL (Base64) des Bildes oder null bei Abbruch
 */
export async function takePhoto(options: TakePhotoOptions = {}): Promise<string | null> {
  requireNative()
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera")
    const photo = await Camera.getPhoto({
      quality: options.quality ?? 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    })
    return photo.dataUrl ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("cancel") || msg.includes("User cancelled")) return null
    throw err
  }
}

/**
 * Push: Registrieren und Token abrufen
 * Gibt den FCM/APNs-Token zurück (für Backend-Registrierung)
 */
export async function registerPushAndGetToken(): Promise<string | null> {
  requireNative()
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications")
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== "granted") {
      throw new Error("Push-Berechtigung wurde verweigert.")
    }
    return new Promise<string | null>(async (resolve, reject) => {
      let settled = false
      const done = (v: string | null) => {
        if (settled) return
        settled = true
        void h.remove()
        resolve(v)
      }
      const h = await PushNotifications.addListener(
        "registration",
        (ev: { value?: string }) => done(ev.value ?? null)
      )
      PushNotifications.register().catch((e) => {
        if (!settled) {
          settled = true
          void h.remove()
          reject(e)
        }
      })
      setTimeout(() => done(null), 10000)
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("denied") || msg.includes("permission")) return null
    throw err
  }
}

/**
 * Preferences: Wert speichern (nur native)
 */
export async function setPreference(key: string, value: string): Promise<void> {
  requireNative()
  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.set({ key, value })
}

/**
 * Preferences: Wert lesen (nur native)
 */
export async function getPreference(key: string): Promise<string | null> {
  requireNative()
  const { Preferences } = await import("@capacitor/preferences")
  const { value } = await Preferences.get({ key })
  return value ?? null
}

/** Re-Export für einfachen Zugriff */
export { checkConnectivity, shareNative, scheduleSessionReminder, hapticSuccess, hapticLight } from "@/lib/native-utils"

/**
 * Hook: Native-Bridge mit Fehlerbehandlung und isNative-Check
 */
export function useNativeBridge() {
  const isNative = Capacitor.isNativePlatform()

  const runBiometric = useCallback(async () => {
    if (!isNative) return { ok: false as const, error: "Nur in der App verfügbar." }
    try {
      const ok = await verifyBiometric()
      return { ok: true as const, success: ok }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  }, [isNative])

  const runTakePhoto = useCallback(async () => {
    if (!isNative) return { ok: false as const, error: "Nur in der App verfügbar." }
    try {
      const dataUrl = await takePhoto()
      return { ok: true as const, dataUrl }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  }, [isNative])

  const runRegisterPush = useCallback(async () => {
    if (!isNative) return { ok: false as const, error: "Nur in der App verfügbar." }
    try {
      const token = await registerPushAndGetToken()
      return { ok: true as const, token }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  }, [isNative])

  return { isNative, runBiometric, runTakePhoto, runRegisterPush }
}

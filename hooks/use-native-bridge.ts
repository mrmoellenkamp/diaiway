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
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric")
    const available = await NativeBiometric.isAvailable()
    if (!available.isAvailable) {
      throw new Error("Biometrie ist auf diesem Gerät nicht verfügbar.")
    }
    await NativeBiometric.verifyIdentity({
      reason,
      title: "Authentifizierung",
      subtitle: "Bestätige deine Identität",
      useFallback: true,
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
 * useFallback: true – Passcode als Fallback erlauben (hilft auf manchen iOS-Geräten)
 */
export async function checkBiometricAvailable(): Promise<{ available: boolean; type?: string }> {
  if (!Capacitor.isNativePlatform()) return { available: false }
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric")
    const r = await NativeBiometric.isAvailable({ useFallback: true })
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
  /**
   * Android: `PushNotifications.register()` ruft FirebaseMessaging auf. Ohne
   * `android/app/google-services.json` + Google Services Plugin ist Firebase
   * nicht initialisiert → native IllegalStateException auf dem CapacitorPlugins-
   * Thread → **ganzer Prozess stirbt** (SIGKILL). Ein JS-.catch() fängt das nicht.
   * iOS nutzt APNs über dasselbe Plugin, ohne diesen Firebase-Pfad.
   */
  if (Capacitor.getPlatform() === "android") {
    if (process.env.NEXT_PUBLIC_ANDROID_FCM_ENABLED !== "true") {
      console.warn(
        "[Push] Android FCM übersprungen: NEXT_PUBLIC_ANDROID_FCM_ENABLED=true setzen, sobald google-services.json liegt (docs/ENV.md)."
      )
      return null
    }
  }
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications")
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== "granted") {
      throw new Error("Push-Berechtigung wurde verweigert.")
    }
    return new Promise<string | null>((resolve, reject) => {
      let settled = false
      let handle: Awaited<ReturnType<typeof PushNotifications.addListener>> | undefined

      const done = (v: string | null) => {
        if (settled) return
        settled = true
        void handle?.remove()
        resolve(v)
      }

      void (async () => {
        try {
          handle = await PushNotifications.addListener(
            "registration",
            (ev: { value?: string }) => done(ev.value ?? null)
          )
          void PushNotifications.register().catch((e) => {
            if (!settled) {
              settled = true
              void handle?.remove()
              reject(e)
            }
          })
        } catch (e) {
          reject(e)
        }
      })()

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

// ─── Biometric Credential Storage (iOS Keychain / Android Keystore) ───────────

const BIOMETRIC_SERVER   = "diaiway.com"
const LAST_USER_KEY      = "diaiway_last_user"
const STAY_LOGGED_IN_KEY = "diaiway_stay_logged_in"

/**
 * Speichert Anmeldedaten sicher im System-Keychain (per Biometrie geschützt).
 */
export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  requireNative()
  const { NativeBiometric } = await import("@capgo/capacitor-native-biometric")
  await NativeBiometric.setCredentials({ username: email, password, server: BIOMETRIC_SERVER })
}

/**
 * Gibt gespeicherte Anmeldedaten zurück, oder null falls keine vorhanden.
 */
export async function getBiometricCredentials(): Promise<{ username: string; password: string } | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric")
    const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER })
    return creds?.username ? creds : null
  } catch {
    return null
  }
}

/**
 * Löscht gespeicherte Anmeldedaten aus dem Keychain.
 */
export async function deleteBiometricCredentials(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric")
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER })
  } catch { /* ignore */ }
}

// ─── Last User (Preferences, unverschlüsselt – nur Name+E-Mail für UI) ────────

/**
 * Speichert den zuletzt angemeldeten Nutzer für die Quick-Login-Anzeige.
 */
export async function saveLastUser(info: { email: string; name: string }): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.set({ key: LAST_USER_KEY, value: JSON.stringify(info) })
}

/**
 * Gibt den zuletzt angemeldeten Nutzer zurück, oder null.
 */
export async function getLastUser(): Promise<{ email: string; name: string } | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { Preferences } = await import("@capacitor/preferences")
    const { value } = await Preferences.get({ key: LAST_USER_KEY })
    return value ? (JSON.parse(value) as { email: string; name: string }) : null
  } catch {
    return null
  }
}

// ─── Stay-Logged-In Preference ────────────────────────────────────────────────

/** Speichert ob der Nutzer direkt beim App-Start eingeloggt bleiben möchte. */
export async function saveStayLoggedIn(stay: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.set({ key: STAY_LOGGED_IN_KEY, value: stay ? "1" : "0" })
}

/** Gibt zurück ob der Nutzer "eingeloggt bleiben" gewählt hat. null = noch nie gewählt. */
export async function getStayLoggedIn(): Promise<boolean | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { Preferences } = await import("@capacitor/preferences")
    const { value } = await Preferences.get({ key: STAY_LOGGED_IN_KEY })
    if (value === undefined || value === null || value === "") return null
    return value === "1"
  } catch {
    return null
  }
}

/**
 * Löscht den gespeicherten Last-User (z.B. beim Ausloggen).
 */
export async function clearLastUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { Preferences } = await import("@capacitor/preferences")
  await Preferences.remove({ key: LAST_USER_KEY })
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

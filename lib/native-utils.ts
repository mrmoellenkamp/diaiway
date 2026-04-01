"use client"

import { Capacitor } from "@capacitor/core"
import { parseBerlinDateTime } from "@/lib/date-utils"

/** Stabile numerische ID für LocalNotifications (pro bookingId), Cancel muss gleiche Logik nutzen. */
export function bookingReminderLocalNotificationId(bookingId: string): number {
  let h = 0
  for (let i = 0; i < bookingId.length; i++) {
    h = (Math.imul(31, h) + bookingId.charCodeAt(i)) | 0
  }
  const n = Math.abs(h) % 2147483646
  return n === 0 ? 1 : n
}

/** Nur in nativer App ausführen; im Web no-op. */
function whenNative(fn: () => void): void {
  if (Capacitor.isNativePlatform()) fn()
}

/**
 * Haptisches Feedback (nur native).
 * Aufruf z.B. bei Buchungsbestätigung, Favorit hinzugefügt, Erfolg.
 */
export function hapticSuccess(): void {
  whenNative(async () => {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
      await Haptics.impact({ style: ImpactStyle.Medium })
    } catch {
      /* ignore */
    }
  })
}

/**
 * Leichtes Haptic (z.B. Tap-Feedback).
 */
export function hapticLight(): void {
  whenNative(async () => {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
      await Haptics.impact({ style: ImpactStyle.Light })
    } catch {
      /* ignore */
    }
  })
}

/**
 * Mittleres Haptic (z.B. Warnung bei 4 Min Handshake).
 */
export function hapticMedium(): void {
  whenNative(async () => {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
      await Haptics.impact({ style: ImpactStyle.Medium })
    } catch {
      /* ignore */
    }
  })
}

/**
 * Starkes Haptic (z.B. Zahlung erfasst bei 5 Min Handshake).
 */
export function hapticHeavy(): void {
  whenNative(async () => {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics")
      await Haptics.impact({ style: ImpactStyle.Heavy })
    } catch {
      /* ignore */
    }
  })
}

/**
 * Ist die App verbunden? (nur native – sonst true annehmen)
 */
export async function checkConnectivity(): Promise<{ connected: boolean }> {
  if (!Capacitor.isNativePlatform()) return { connected: true }
  try {
    const { Network } = await import("@capacitor/network")
    const status = await Network.getStatus()
    return { connected: status.connected }
  } catch {
    return { connected: true }
  }
}

/**
 * Profil/URL teilen (nur native).
 */
export async function shareNative(options: { title: string; text?: string; url?: string }): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { Share } = await import("@capacitor/share")
    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
    })
    return true
  } catch {
    return false
  }
}

function isShareUserCancelError(e: unknown): boolean {
  const msg =
    e instanceof Error
      ? `${e.name} ${e.message}`
      : typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: string }).message)
        : String(e)
  return /cancel|canceled|cancelled|dismiss|did not share|user.*cancel|abort/i.test(msg)
}

/**
 * ICS über System-Share öffnen (Kalender, Dateien, …). WebView-unterstützt.
 *
 * Wichtig: Auf Android akzeptiert @capacitor/share nur `file:`-URLs für Dateien.
 * `Filesystem.getUri()` liefert dort oft `content://` → Share bricht ohne UI ab.
 * Daher: `writeFile` nutzen und die zurückgegebene `uri` (typisch `file://…`) an
 * `Share.share({ url })` übergeben (wie in der Capacitor-Doku beim Camera-File).
 */
export async function shareBookingIcsViaNativeSheet(options: {
  blob: Blob
  fileName: string
  title: string
  dialogTitle?: string
}): Promise<"shared" | "cancelled" | "skipped"> {
  if (!Capacitor.isNativePlatform()) return "skipped"
  const safeName = options.fileName.replace(/[/\\?%*:|"<>]/g, "_") || "termin.ics"
  const subdir = "diaiway-calendar"
  const path = `${subdir}/${Date.now()}-${safeName}`
  try {
    const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem")
    const { Share } = await import("@capacitor/share")
    const data = await options.blob.text()
    try {
      await Filesystem.mkdir({
        path: subdir,
        directory: Directory.Cache,
        recursive: true,
      })
    } catch {
      /* exists */
    }
    const { uri } = await Filesystem.writeFile({
      path,
      directory: Directory.Cache,
      data,
      encoding: Encoding.UTF8,
    })
    if (!uri?.trim()) return "skipped"

    try {
      await Share.share({
        title: options.title,
        url: uri,
        dialogTitle: options.dialogTitle,
      })
    } catch (e) {
      if (isShareUserCancelError(e)) throw e
      try {
        await Share.share({
          title: options.title,
          files: [uri],
          dialogTitle: options.dialogTitle,
        })
      } catch (e2) {
        if (isShareUserCancelError(e2)) throw e2
        throw e
      }
    }
    return "shared"
  } catch (e) {
    if (isShareUserCancelError(e)) return "cancelled"
    return "skipped"
  }
}

/**
 * Session-Erinnerung planen (5 Min vor Start, Zeitzone Europe/Berlin wie die Buchung).
 * Nur native; bei fehlender Berechtigung oder vergangenem Zeitpunkt no-op.
 */
const SESSION_CHANNEL_ID = "session-reminders"

export async function scheduleSessionReminder(booking: {
  id: string
  date: string
  startTime: string
  /** Android channel label + notification copy (use i18n on the caller). */
  channelName: string
  title: string
  body: string
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications")
    if (Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: SESSION_CHANNEL_ID,
        name: booking.channelName,
        importance: 4,
        vibration: true,
      })
    }
    const permissions = await LocalNotifications.checkPermissions()
    let status = permissions.display
    if (status !== "granted") {
      const request = await LocalNotifications.requestPermissions()
      status = request.display
      if (status !== "granted") return
    }

    const sessionStart = parseBerlinDateTime(booking.date, booking.startTime || "00:00")
    const at = new Date(sessionStart.getTime() - 5 * 60 * 1000)
    if (at.getTime() <= Date.now()) return

    const nid = bookingReminderLocalNotificationId(booking.id)
    await LocalNotifications.schedule({
      notifications: [
        {
          id: nid,
          channelId: SESSION_CHANNEL_ID,
          title: booking.title,
          body: booking.body,
          schedule: { at },
          sound: "default",
        },
      ],
    })
  } catch {
    /* ignore */
  }
}

/**
 * Geplante Erinnerungen für vergangene Sessions abbrechen.
 */
export async function cancelPastReminders(bookingIds: string[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || bookingIds.length === 0) return
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications")
    const ids = bookingIds.map((id) => bookingReminderLocalNotificationId(id))
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) })
  } catch {
    /* ignore */
  }
}

/**
 * Session active reminder channel (for background notification).
 */
const SESSION_ACTIVE_CHANNEL_ID = "session-active"

/**
 * Zeigt eine lokale Benachrichtigung wenn die App in den Hintergrund geht während einer Session.
 * "Session still active. Tap to return."
 */
export async function scheduleSessionActiveNotification(opts: {
  channelName: string
  title: string
  body: string
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications")
    if (Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: SESSION_ACTIVE_CHANNEL_ID,
        name: opts.channelName,
        importance: 3,
      })
    }
    const permissions = await LocalNotifications.checkPermissions()
    let status = permissions.display
    if (status !== "granted") {
      const request = await LocalNotifications.requestPermissions()
      status = request.display
      if (status !== "granted") return
    }
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9001,
          channelId: SESSION_ACTIVE_CHANNEL_ID,
          title: opts.title,
          body: opts.body,
          schedule: { at: new Date(Date.now() + 500) },
        },
      ],
    })
  } catch {
    /* ignore */
  }
}

/**
 * Entfernt die "Session aktiv"-Benachrichtigung.
 */
export async function cancelSessionActiveNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications")
    await LocalNotifications.cancel({ notifications: [{ id: 9001 }] })
  } catch {
    /* ignore */
  }
}

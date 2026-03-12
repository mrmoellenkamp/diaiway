"use client"

import { Capacitor } from "@capacitor/core"

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

/**
 * Session-Erinnerung planen (30 Min vor Start).
 * Nur native; bricht ab wenn nicht verbunden.
 */
const SESSION_CHANNEL_ID = "session-reminders"

export async function scheduleSessionReminder(booking: {
  id: string
  expertName: string
  date: string
  startTime: string
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications")
    if (Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: SESSION_CHANNEL_ID,
        name: "Session-Erinnerungen",
        importance: 4,
      })
    }
    const { status } = await LocalNotifications.checkPermissions()
    if (status !== "granted") {
      const { status: req } = await LocalNotifications.requestPermissions()
      if (req !== "granted") return
    }

    const [year, month, day] = booking.date.split("-").map(Number)
    const [hour, min] = (booking.startTime || "10:00").split(":").map(Number)
    const at = new Date(year, month - 1, day, hour, min - 30, 0)
    if (at.getTime() <= Date.now()) return

    const id = parseInt(booking.id.replace(/\D/g, "").slice(-8) || "0", 16) % 2147483647
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.abs(id) || 1,
          channelId: SESSION_CHANNEL_ID,
          title: "Session-Erinnerung",
          body: `Deine Session mit ${booking.expertName} startet in 30 Minuten.`,
          schedule: { at },
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
    const ids = bookingIds.map((id) => {
      const n = parseInt(id.replace(/\D/g, "").slice(-8) || "0", 16) % 2147483647
      return Math.abs(n) || 1
    })
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) })
  } catch {
    /* ignore */
  }
}

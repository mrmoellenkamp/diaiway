/**
 * Capacitor Push: Quick Action handler for Instant Connect.
 * Listens to pushNotificationActionPerformed and handles ACCEPT/DECLINE.
 */
import { Capacitor } from "@capacitor/core"
import { hapticHeavy } from "./native-utils"

export type QuickActionCallback = (params: {
  bookingId: string
  statusToken: string
  action: "ACCEPT" | "DECLINE"
}) => void

let listenerRemove: (() => void) | undefined

/**
 * Start listening for push notification actions.
 * Call when app is ready (e.g. in a provider).
 */
export function startQuickActionPushListener(
  onAction: QuickActionCallback
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  const setup = async () => {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications")
      const { App } = await import("@capacitor/app")

      const handle = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        async (ev) => {
          const notif = ev.notification as { data?: { bookingId?: string; statusToken?: string; type?: string } }
          const data = notif?.data
          const actionId = (ev as { actionId?: string }).actionId || ""

          if (data?.type !== "BOOKING_REQUEST" || !data?.bookingId || !data?.statusToken) return

          const action = actionId === "ACCEPT" || actionId === "DECLINE"
            ? actionId
            : actionId || "ACCEPT"

          if (action === "ACCEPT") {
            hapticHeavy()
            onAction({
              bookingId: data.bookingId,
              statusToken: data.statusToken,
              action: "ACCEPT",
            })
          } else if (action === "DECLINE") {
            onAction({
              bookingId: data.bookingId,
              statusToken: data.statusToken,
              action: "DECLINE",
            })
          }
        }
      )

      listenerRemove = () => handle.remove()
    } catch (e) {
      console.warn("[QuickAction] Push listener setup failed:", e)
    }
  }

  setup()
  return () => listenerRemove?.()
}

/**
 * Register Android notification channel with actions for BOOKING_REQUEST.
 */
export async function registerBookingRequestChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (Capacitor.getPlatform() !== "android") return

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications")
    const channels = await PushNotifications.listChannels()
    const exists = channels.channels?.some((c) => c.id === "BOOKING_REQUEST")
    if (exists) return

    await PushNotifications.createChannel({
      id: "BOOKING_REQUEST",
      name: "Instant-Anfragen",
      description: "Schnelle Reaktion auf Instant Connect",
      importance: 5,
      vibration: true,
    })
  } catch (e) {
    console.warn("[QuickAction] Channel registration failed:", e)
  }
}

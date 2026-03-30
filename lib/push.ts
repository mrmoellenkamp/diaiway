/**
 * Web Push — send push notifications to subscribed users.
 * Requires VAPID keys in VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
 */

import webpush from "web-push"
import { prisma } from "@/lib/db"
import type { AppLocale } from "@/lib/i18n/types"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"
import type { FcmPushType } from "@/lib/push-fcm"

let vapidConfigured = false

function initVapid() {
  if (vapidConfigured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (publicKey && privateKey) {
    webpush.setVapidDetails(
      "mailto:info@diaiway.com",
      publicKey,
      privateKey
    )
    vapidConfigured = true
  }
}

export interface PushPayload {
  title: string
  body?: string
  url?: string
  tag?: string
  /** FCM Android channel + iOS category — determines notification tray. Default: GENERAL */
  pushType?: FcmPushType
  /** For Quick Actions: BOOKING_REQUEST with data for instant connect */
  data?: {
    type?: string
    bookingId?: string
    statusToken?: string
  }
}

/**
 * Send a push notification to all subscriptions of a user.
 * Uses Web Push (VAPID) and FCM (native) when available.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const webPushPromise = (async () => {
    initVapid()
    if (!vapidConfigured) return
    try {
      const subs = await prisma.pushSubscription.findMany({
        where: { userId },
        select: { endpoint: true, p256dh: true, auth: true },
      })
      if (subs.length === 0) return

      const pushPayload = JSON.stringify({
        title: payload.title,
        body: payload.body ?? "",
        url: payload.url ?? "/messages",
        tag: payload.tag ?? "diaiway-notification",
        ...(payload.data && { data: payload.data }),
      })

      const results = await Promise.allSettled(
        subs.map((sub) =>
          webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload,
            { TTL: 86400 } // 24h
          )
        )
      )

      const toDelete: number[] = []
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const err = r.reason
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            toDelete.push(i)
          }
        }
      })
      if (toDelete.length > 0) {
        const endpointsToRemove = toDelete.map((i) => subs[i].endpoint)
        await prisma.pushSubscription.deleteMany({
          where: { userId, endpoint: { in: endpointsToRemove } },
        })
      }
    } catch (err) {
      console.error("[Push] Web push error:", err)
    }
  })()

  const fcmPromise = (async () => {
    try {
      const { sendFcmToUser } = await import("./push-fcm")
      const data: Record<string, string> = {
        url: payload.url ?? "/messages",
        ...(payload.data?.type && { type: payload.data.type }),
        ...(payload.data?.bookingId && { bookingId: payload.data.bookingId }),
        ...(payload.data?.statusToken && { statusToken: payload.data.statusToken }),
      }
      await sendFcmToUser(userId, {
        title: payload.title,
        body: payload.body,
        data,
        pushType: payload.pushType,
      })
    } catch {
      /* FCM not configured */
    }
  })()

  try {
    await Promise.allSettled([webPushPromise, fcmPromise])
  } catch (err) {
    console.error("[Push] sendPushToUser error:", err)
  }
}

/**
 * Resolves the recipient's saved UI language (preferredLocale) and builds the payload.
 * Use for all user-facing pushes (cron, booking flows, messages).
 */
export async function sendLocalizedPushToUser(
  userId: string,
  build: (locale: AppLocale) => PushPayload
): Promise<void> {
  const locale = await getUserPreferredLocale(userId)
  await sendPushToUser(userId, build(locale))
}

/**
 * Web Push — send push notifications to subscribed users.
 * Requires VAPID keys in VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.
 */

import webpush from "web-push"
import { prisma } from "@/lib/db"

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
}

/**
 * Send a push notification to all subscriptions of a user.
 * Silently skips if VAPID is not configured or user has no subscriptions.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
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

    // Remove invalid/expired subscriptions
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
    console.error("[Push] sendPushToUser error:", err)
  }
}

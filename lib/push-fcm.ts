/**
 * FCM push for native (Capacitor).
 * Requires GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.
 */
import { prisma } from "@/lib/db"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fcmAdmin: any = null

async function initFcm() {
  if (fcmAdmin) return fcmAdmin
  try {
    const admin = await import("firebase-admin")
    if (admin.apps.length === 0) {
      const cred = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      if (cred) {
        const json = JSON.parse(cred) as object
        admin.initializeApp({ credential: admin.credential.cert(json) })
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() })
      } else {
        return null
      }
    }
    fcmAdmin = admin
    return fcmAdmin
  } catch {
    return null
  }
}

export type FcmPushType =
  | "BOOKING_REQUEST"   // Neue Buchungsanfrage / Instant-Anklopf (Quick-Action-fähig)
  | "BOOKING_UPDATE"    // Bestätigung, Ablehnung, Rückfrage, Storno
  | "MESSAGE"           // Chat-/Waymail-Nachricht
  | "REMINDER"          // Session-Erinnerung
  | "PAYMENT"           // Zahlung erfolgreich / Fehler / Wallet-Topup
  | "GENERAL"           // Sonstige System-Benachrichtigungen

export interface FcmPayload {
  title: string
  body?: string
  data?: Record<string, string>
  /** Push-Typ für korrekte Android-Channel-ID und iOS-Kategorie. Standard: GENERAL */
  pushType?: FcmPushType
}

export async function sendFcmToUser(
  userId: string,
  payload: FcmPayload
): Promise<void> {
  const admin = await initFcm()
  if (!admin) return

  try {
    const tokens = await prisma.fcmToken.findMany({
      where: { userId },
      select: { token: true },
    })
    if (tokens.length === 0) return

    const pushType: FcmPushType = payload.pushType ?? "GENERAL"

    const message = {
      notification: {
        title: payload.title,
        body: payload.body ?? "",
        sound: "default",
      },
      data: {
        ...payload.data,
        url: payload.data?.url ?? "/messages",
      },
      android: {
        priority: "high" as const,
        notification: {
          channelId: pushType,
          priority: "high" as const,
        },
      },
      apns: {
        payload: {
          aps: {
            category: pushType,
            sound: "default",
            "mutable-content": 1,
          },
        },
      },
    }

    const results = await Promise.allSettled(
      tokens.map((t) =>
        admin.messaging().send({ ...message, token: t.token })
      )
    )

    const invalid: string[] = []
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const err = r.reason
        if (err?.code === "messaging/invalid-registration-token" || err?.code === "messaging/registration-token-not-registered") {
          invalid.push(tokens[i].token)
        }
      }
    })
    if (invalid.length > 0) {
      await prisma.fcmToken.deleteMany({
        where: { token: { in: invalid } },
      })
    }
  } catch (err) {
    console.error("[Push] FCM send error:", err)
  }
}

"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"

/**
 * Registers the service worker and subscribes the user to push notifications
 * when logged in. Runs once per session.
 */
export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey?.trim()) return

    let cancelled = false

    async function setupPush() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) return

        const reg = await navigator.serviceWorker.register("/sw.js")
        await reg.update()

        const permission = await Notification.requestPermission()
        if (permission !== "granted" || cancelled) return

        const sub = await reg.pushManager.getSubscription()
        if (sub && cancelled) return

        const subscription =
          sub ||
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }))

        if (cancelled) return

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(
                String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!))
              ),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!))),
            },
          }),
        })
      } catch (err) {
        console.warn("[Push] Setup failed:", err)
      }
    }

    setupPush()
    return () => {
      cancelled = true
    }
  }, [status, session?.user])

  return <>{children}</>
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

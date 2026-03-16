"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
import { toast } from "sonner"

/**
 * Deep-Link-Handler: Leitet Links zu diaiway.com/* direkt in die App weiter.
 * Wenn ein Nutzer z.B. diaiway.com/takumi/123 in WhatsApp antippt, öffnet die App
 * und zeigt sofort das Takumi-Profil statt der Startseite.
 *
 * Sonderfall: diaiway://booking-confirmed/<id> — kommt vom In-App-Browser nach
 * erfolgreicher Zahlung. Der Browser wird geschlossen und zur Buchungsübersicht
 * navigiert.
 */
export function DeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handleUrl = async (url: string) => {
      try {
        // booking-confirmed Deep Link vom In-App-Browser
        if (url.startsWith("diaiway://booking-confirmed")) {
          const { Browser } = await import("@capacitor/browser")
          await Browser.close()
          import("@/lib/native-utils").then(({ hapticSuccess }) => hapticSuccess())
          toast.success("Ihre Zahlung wurde sicher durchgeführt. Sie werden in Ihre Buchungsübersicht weitergeleitet.")
          router.push("/sessions?tab=upcoming")
          return
        }

        // wallet-topup-confirmed Deep Link vom In-App-Browser
        if (url.startsWith("diaiway://wallet-topup-confirmed")) {
          const { Browser } = await import("@capacitor/browser")
          await Browser.close()
          import("@/lib/native-utils").then(({ hapticSuccess }) => hapticSuccess())
          toast.success("Ihr Wallet wurde erfolgreich aufgeladen!")
          router.push("/profile/finances")
          return
        }

        const parsed = new URL(url)
        if (!parsed.hostname.includes("diaiway.com")) return
        const path = parsed.pathname + parsed.search
        if (path && path !== "/") router.push(path)
      } catch {
        // ignore invalid URLs
      }
    }

    const setup = async () => {
      const { App } = await import("@capacitor/app")
      // Launch-URL (App wurde über Link geöffnet)
      const launchUrl = await App.getLaunchUrl()
      if (launchUrl?.url) await handleUrl(launchUrl.url)
      // Zukünftige Öffnungen (App war im Hintergrund)
      const handle = await App.addListener("appUrlOpen", (ev: { url: string }) => {
        if (ev.url) void handleUrl(ev.url)
      })
      return () => {
        void handle.remove()
      }
    }

    let cleanup: (() => void) | undefined
    setup().then((c) => { cleanup = c })
    return () => { cleanup?.() }
  }, [router])

  return null
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"

/**
 * Deep-Link-Handler: Leitet Links zu diaiway.com/* direkt in die App weiter.
 * Wenn ein Nutzer z.B. diaiway.com/takumi/123 in WhatsApp antippt, öffnet die App
 * und zeigt sofort das Takumi-Profil statt der Startseite.
 */
export function DeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const navigateToUrl = (url: string) => {
      try {
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
      if (launchUrl?.url) navigateToUrl(launchUrl.url)
      // Zukünftige Öffnungen (App war im Hintergrund)
      const handle = await App.addListener("appUrlOpen", (ev: { url: string }) => {
        if (ev.url) navigateToUrl(ev.url)
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

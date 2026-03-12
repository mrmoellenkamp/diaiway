"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"

/**
 * Versteckt den Splash Screen, sobald die App gerendert hat (nur in nativer Capacitor-Umgebung).
 * Der Splash bleibt sichtbar, bis diese Komponente mounted und die Seite bereit ist.
 */
export function SplashScreenHider() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const hide = async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen")
        await SplashScreen.hide()
      } catch {
        // Plugin nicht verfügbar oder nicht injiziert (z.B. bei externer URL)
      }
    }

    // Kurz warten, bis der erste Paint erfolgt ist
    const id = requestAnimationFrame(() => {
      setTimeout(hide, 300)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return null
}

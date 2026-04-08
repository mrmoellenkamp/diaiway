"use client"

import { useState, useEffect } from "react"
import { Capacitor } from "@capacitor/core"

/**
 * Capacitor.isNativePlatform() darf nicht beim ersten Render (SSR vs. WebView-Client)
 * unterschiedlich sein — sonst React Hydration #418 und Abstürze in der nativen App.
 * Erst nach mount den echten Wert setzen.
 */
export function useIsNativeCapacitor(): boolean {
  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])
  return isNative
}

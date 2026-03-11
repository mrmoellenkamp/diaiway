"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/** Scrollt beim Wechsel der Route nach oben */
export function ScrollToTop() {
  const pathname = usePathname()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [pathname])
  return null
}

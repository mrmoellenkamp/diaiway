"use client"

import { Loader2 } from "lucide-react"

/**
 * Full-screen "Connecting..." overlay while Daily.co room is initializing.
 */
export function ConnectingSplash() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="size-12 animate-spin text-primary" />
      <p className="text-lg font-medium text-foreground">Verbinde...</p>
      <p className="text-sm text-muted-foreground">
        Daily.co-Session wird vorbereitet
      </p>
    </div>
  )
}

/**
 * VideoConfig — Einstiegspunkt für Video/Voice-Calls.
 * Dynamic import mit ssr: false für @daily-co/daily-js.
 */
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import type { CallEngineProps } from "@/components/call-engine"

export const CallEngine = dynamic<CallEngineProps>(
  () => import("@/components/call-engine").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
        <Loader2 className="size-10 animate-spin text-primary-foreground/60" />
      </div>
    ),
  }
)

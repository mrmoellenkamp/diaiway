/**
 * VideoConfig — einziger Einstiegspunkt für @daily-co-Pakete.
 *
 * next/dynamic mit { ssr: false } stellt sicher, dass kein @daily-co-Code
 * den Next.js-Server-Renderer oder den Vercel-Build-Worker berührt.
 * Alle anderen Dateien importieren von hier — nie direkt von @daily-co.
 */
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import type { DailyVideoCallProps } from "@/components/daily-prebuilt-call"
import type { AudioCallInterfaceProps } from "@/components/audio-call-interface"

export const DailyVideoCall = dynamic<DailyVideoCallProps>(
  () => import("@/components/daily-prebuilt-call"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
        <Loader2 className="size-10 animate-spin text-primary-foreground/60" />
      </div>
    ),
  }
)

export const DailyAudioCall = dynamic<AudioCallInterfaceProps>(
  () => import("@/components/audio-call-interface"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
        <Loader2 className="size-10 animate-spin text-primary-foreground/60" />
      </div>
    ),
  }
)

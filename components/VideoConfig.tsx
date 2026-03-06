/**
 * VideoConfig — Client-only barrier for @daily-co packages.
 *
 * This is the SINGLE authoritative place where Daily.co is referenced.
 * The dynamic import with { ssr: false } guarantees that no @daily-co code
 * ever reaches the Next.js server renderer or Vercel build worker.
 *
 * Import from here — never import directly from @daily-co anywhere else.
 */
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import type { DailyVideoCallProps } from "@/components/daily-video-call"

export const DailyVideoCall = dynamic<DailyVideoCallProps>(
  () =>
    import("@/components/daily-video-call").then((mod) => ({
      default: mod.DailyVideoCall,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
        <Loader2 className="size-10 animate-spin text-primary-foreground/60" />
      </div>
    ),
  }
)

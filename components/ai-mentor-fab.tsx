"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { MentorChat } from "@/components/mentor-chat"
import { useApp } from "@/lib/app-context"
import { useI18n } from "@/lib/i18n"

export function AiMentorFab() {
  const { isMentorOpen: isOpen, setMentorOpen: setIsOpen } = useApp()
  const { t } = useI18n()
  const pathname = usePathname() ?? ""

  /** Seiten mit eingebetteter AI-Box — kein doppelter Assistent per FAB */
  const hasEmbeddedAiBox =
    pathname === "/ai-guide" ||
    pathname.startsWith("/ai-guide/") ||
    pathname === "/categories" ||
    pathname.startsWith("/categories/")

  const hideFab =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/beta") ||
    hasEmbeddedAiBox

  useEffect(() => {
    if (hasEmbeddedAiBox) setIsOpen(false)
  }, [hasEmbeddedAiBox, setIsOpen])

  if (hideFab) return null

  return (
    <>
      {/* FAB Button - z-45 to be between header (z-40) and bottom-nav (z-50) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed right-4 z-[45] flex size-14 items-center justify-center rounded-full bg-primary shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_10px_28px_rgba(6,78,59,0.28)] transition-all hover:scale-105 hover:shadow-xl active:scale-95 pointer-events-auto",
            "bottom-[max(8.5rem,calc(2rem+env(safe-area-inset-bottom,0px)))]" // über Footer (Icons + Links + Safe Area)
          )}
          aria-label={t("mentor.open")}
        >
          <Sparkles className="size-6 text-accent" />
          <span className="absolute -top-0.5 -right-0.5 flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50" />
            <span className="relative inline-flex size-3 rounded-full bg-accent" />
          </span>
        </button>
      )}

      {/* Chat Window – öffnet am FAB, nutzt verfügbare Höhe */}
      {isOpen && (
        <div
          className={cn(
            "fixed right-3 z-[100] flex min-h-0 w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-[rgba(6,78,59,0.15)] bg-card shadow-2xl pointer-events-auto",
            "animate-in fade-in slide-in-from-bottom-4 duration-300",
            "bottom-[max(8.5rem,calc(2rem+env(safe-area-inset-bottom,0px)))] max-h-mentor-fab-window"
          )}
          role="dialog"
          aria-label={t("mentor.chat")}
        >
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-3 top-3 z-10 flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full bg-[rgba(255,255,255,0.92)] text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-foreground active:scale-95"
            aria-label={t("mentor.close")}
          >
            <X className="size-5" />
          </button>

          <MentorChat variant="floating" className="min-h-0 flex-1" />
        </div>
      )}
    </>
  )
}

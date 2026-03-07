"use client"

import { usePathname } from "next/navigation"
import { Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { MentorChat } from "@/components/mentor-chat"
import { useApp } from "@/lib/app-context"

export function AiMentorFab() {
  const { isMentorOpen: isOpen, setMentorOpen: setIsOpen } = useApp()
  const pathname = usePathname()

  const isInApp =
    pathname.startsWith("/home") ||
    pathname.startsWith("/ai-guide") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/sessions") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/takumi") ||
    pathname.startsWith("/booking") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/messages")

  // Hide on landing page (embedded chat), auth pages, and onboarding
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/onboarding"
  ) {
    return null
  }

  return (
    <>
      {/* FAB Button - z-45 to be between header (z-40) and bottom-nav (z-50) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed right-4 z-[45] flex size-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:shadow-xl active:scale-95 pointer-events-auto",
            isInApp ? "bottom-[max(6rem,calc(1.5rem+env(safe-area-inset-bottom)))]" : "bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
          )}
          aria-label="Projekt-Mentor offnen"
        >
          <Sparkles className="size-6 text-accent" />
          <span className="absolute -top-0.5 -right-0.5 flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50" />
            <span className="relative inline-flex size-3 rounded-full bg-accent" />
          </span>
        </button>
      )}

      {/* Chat Window - z-[100] to be above everything */}
      {isOpen && (
        <div
          className={cn(
            "fixed right-3 z-[100] flex w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-2xl pointer-events-auto",
            "animate-in fade-in slide-in-from-bottom-4 duration-300",
            isInApp
              ? "bottom-[max(6rem,calc(1.5rem+env(safe-area-inset-bottom)))] max-h-[calc(100vh-10rem)]"
              : "bottom-[max(1rem,env(safe-area-inset-bottom))] max-h-[calc(100vh-2rem)]"
          )}
          role="dialog"
          aria-label="Projekt-Mentor Chat"
        >
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-3 top-3 z-10 flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground active:scale-95"
            aria-label="Chat schliessen"
          >
            <X className="size-5" />
          </button>

          <MentorChat variant="floating" className="h-[520px]" />
        </div>
      )}
    </>
  )
}

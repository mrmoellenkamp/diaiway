"use client"

import { useEffect } from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageLightboxProps {
  /** Bild-URL zum Anzeigen */
  src: string
  /** Optionaler Alt-Text */
  alt?: string
  /** Zusätzliche Info (z.B. Titel) unter dem Bild */
  caption?: string
  /** Schließen-Callback */
  onClose: () => void
  /** Offen/geschlossen */
  open: boolean
  className?: string
}

export function ImageLightbox({
  src,
  alt = "",
  caption,
  onClose,
  open,
  className,
}: ImageLightboxProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (open) {
      document.addEventListener("keydown", handleKey)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bild vergrößert anzeigen"
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm",
        className
      )}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Schließen"
      >
        <X className="size-5" />
      </button>

      <div
        className="relative flex max-h-[90vh] max-w-[95vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg">
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={800}
            className="h-auto w-full object-contain"
            unoptimized
            priority
          />
        </div>
        {caption && (
          <p className="mt-3 max-w-2xl text-center text-sm text-white/90">
            {caption}
          </p>
        )}
      </div>
    </div>
  )
}

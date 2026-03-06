"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Camera, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  /** Current image URL (controlled) */
  value: string
  /** Called with the new Vercel Blob URL after a successful upload */
  onChange: (url: string) => void
  /** Upload subfolder, e.g. "profiles" or "experts" */
  folder?: string
  /** Show as a round avatar */
  variant?: "avatar" | "card"
  /** Optional placeholder shown when no image is set */
  placeholder?: string
  className?: string
  disabled?: boolean
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_MB = 5

export function ImageUpload({
  value,
  onChange,
  folder = "uploads",
  variant = "card",
  placeholder,
  className,
  disabled = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Nur JPG, PNG, WebP und GIF erlaubt.")
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Maximale Dateigröße: ${MAX_SIZE_MB} MB.`)
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", folder)

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Upload fehlgeschlagen.")
        return
      }
      onChange(data.url)
      toast.success("Bild erfolgreich hochgeladen.")
    } catch {
      toast.error("Netzwerkfehler beim Upload.")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ── Avatar variant (round, used in profile) ─────────────────────────────────
  if (variant === "avatar") {
    return (
      <div className={cn("relative inline-block", className)}>
        <div className="size-24 rounded-full overflow-hidden border-4 border-border bg-muted">
          {value ? (
            <Image src={value} alt="Avatar" fill className="object-cover" sizes="96px" />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
              {placeholder || <Camera className="size-8 text-muted-foreground/50" />}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary shadow-md transition-colors hover:bg-primary/90 disabled:opacity-50"
          aria-label="Bild hochladen"
        >
          {isUploading ? (
            <Loader2 className="size-3.5 animate-spin text-primary-foreground" />
          ) : (
            <Camera className="size-3.5 text-primary-foreground" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>
    )
  }

  // ── Card variant (rectangular, used in admin / expert forms) ─────────────────
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 transition-colors",
          "hover:border-primary/50 hover:bg-primary/5",
          value ? "h-36" : "h-28",
          (disabled || isUploading) && "cursor-not-allowed opacity-60"
        )}
        aria-label="Bild hochladen"
      >
        {value ? (
          <>
            <Image
              src={value}
              alt="Vorschau"
              fill
              className="object-cover"
              sizes="300px"
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
              <p className="text-xs font-medium text-white">Bild ersetzen</p>
            </div>
          </>
        ) : (
          <>
            {isUploading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-6 text-muted-foreground/60" />
            )}
            <p className="text-xs text-muted-foreground">
              {isUploading ? "Wird hochgeladen..." : "Klicken oder Bild reinziehen"}
            </p>
            <p className="text-[10px] text-muted-foreground/60">JPG, PNG, WebP · max. 5 MB</p>
          </>
        )}
      </div>

      {/* Remove button */}
      {value && !isUploading && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange("") }}
          className="flex items-center gap-1.5 self-start text-[11px] text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3" />
          Bild entfernen
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}

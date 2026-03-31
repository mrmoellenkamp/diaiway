"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Camera, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { compressImageFileForUpload, MAX_RAW_IMAGE_BYTES } from "@/lib/browser-image-compress"
import { parseUploadResponseJson } from "@/lib/parse-upload-response"

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

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
/** Rohfoto vom Gerät; vor dem Request wird im Browser verkleinert (Vercel ~4,5 MB Request-Limit). */
const MAX_RAW_MB = Math.floor(MAX_RAW_IMAGE_BYTES / 1024 / 1024)

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
  const { t } = useI18n()

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t("imageUpload.fileTypeError"))
      return
    }
    if (file.size > MAX_RAW_IMAGE_BYTES) {
      toast.error(t("imageUpload.fileSizeError", { mb: String(MAX_RAW_MB) }))
      return
    }

    setIsUploading(true)
    try {
      const prepared = await compressImageFileForUpload(file)
      const formData = new FormData()
      formData.append("file", prepared, prepared.name || "upload.jpg")
      formData.append("folder", folder)

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await parseUploadResponseJson(res)

      if (!res.ok) {
        toast.error(data.error || t("imageUpload.uploadError"))
        return
      }
      if (!data.url) {
        toast.error(t("imageUpload.uploadError"))
        return
      }
      onChange(data.url)
      toast.success(t("imageUpload.uploadSuccess"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("imageUpload.uploadNetworkError"))
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
            <Image src={value} alt="Avatar" fill className="object-cover" sizes="96px" quality={75} />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
              {placeholder || <Camera className="size-8 text-[rgba(120,113,108,0.5)]" />}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="absolute bottom-0 right-0 flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full border-2 border-background bg-primary shadow-md transition-colors hover:bg-[rgba(6,78,59,0.9)] disabled:opacity-50 touch-manipulation"
          aria-label={t("imageUpload.ariaUpload")}
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
          "relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-[rgba(245,245,244,0.3)] transition-colors",
          "hover:border-[rgba(6,78,59,0.5)] hover:bg-[rgba(6,78,59,0.05)]",
          value ? "h-36" : "h-28",
          (disabled || isUploading) && "cursor-not-allowed opacity-60"
        )}
        aria-label={t("imageUpload.ariaUpload")}
      >
        {value ? (
          <>
            <Image
              src={value}
              alt="Vorschau"
              fill
              className="object-cover"
              sizes="300px"
              quality={75}
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.4)] opacity-0 transition-opacity hover:opacity-100">
              <p className="text-xs font-medium text-white">{t("imageUpload.replaceImage")}</p>
            </div>
          </>
        ) : (
          <>
            {isUploading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-6 text-[rgba(120,113,108,0.6)]" />
            )}
            <p className="text-xs text-muted-foreground">
              {isUploading ? t("imageUpload.uploading") : t("imageUpload.dragDrop")}
            </p>
            <p className="text-[10px] text-[rgba(120,113,108,0.6)]">{t("imageUpload.formatHint")}</p>
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
          {t("imageUpload.removeImage")}
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

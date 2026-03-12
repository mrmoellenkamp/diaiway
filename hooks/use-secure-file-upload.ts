"use client"

import { useState, useCallback } from "react"
import { pickFileForChat, validateFileForUpload } from "@/lib/secure-file-picker"

export type UploadPhase = "idle" | "scanning" | "preview" | "uploading" | "done" | "error"

export interface UploadResult {
  url: string
  thumbnailUrl: string | null
  filename: string
}

export function useSecureFileUpload() {
  const [phase, setPhase] = useState<UploadPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)

  const upload = useCallback(async (): Promise<UploadResult | null> => {
    setError(null)
    setResult(null)
    const file = await pickFileForChat()
    if (!file) return null

    const validation = validateFileForUpload(file)
    if (!validation.ok) {
      setError(validation.error)
      setPhase("error")
      return null
    }

    setPhase("scanning")
    const formData = new FormData()
    formData.append("file", file)

    try {
      setPhase("preview")
      const res = await fetch("/api/files/secure-upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Upload fehlgeschlagen.")
        setPhase("error")
        return null
      }

      setPhase("done")
      const uploadResult: UploadResult = {
        url: data.url,
        thumbnailUrl: data.thumbnailUrl ?? null,
        filename: data.filename ?? file.name,
      }
      setResult(uploadResult)
      return uploadResult
    } catch (e) {
      setError("Upload fehlgeschlagen.")
      setPhase("error")
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setPhase("idle")
    setError(null)
    setResult(null)
  }, [])

  const statusLabel =
    phase === "scanning"
      ? "Scanne auf Viren…"
      : phase === "preview"
        ? "Generiere Vorschau…"
        : phase === "uploading"
          ? "Wird hochgeladen…"
          : null

  return { upload, phase, error, result, statusLabel, reset }
}

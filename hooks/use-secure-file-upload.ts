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

  const upload = useCallback(async (): Promise<{ ok: true; result: UploadResult } | { ok: false; error: string }> => {
    setError(null)
    setResult(null)
    const file = await pickFileForChat()
    if (!file) return { ok: false as const, error: "" }

    const validation = validateFileForUpload(file)
    if (!validation.ok) {
      setError(validation.error)
      setPhase("error")
      return { ok: false as const, error: validation.error }
    }

    setPhase("scanning")
    const formData = new FormData()
    formData.append("file", file)

    try {
      setPhase("preview")
      const res = await fetch("/api/files/secure-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const data = await res.json()

      if (!res.ok) {
        const errMsg = data.error ?? "Upload fehlgeschlagen."
        setError(errMsg)
        setPhase("error")
        return { ok: false as const, error: errMsg }
      }

      setPhase("done")
      const uploadResult: UploadResult = {
        url: data.url,
        thumbnailUrl: data.thumbnailUrl ?? null,
        filename: data.filename ?? file.name,
      }
      setResult(uploadResult)
      return { ok: true as const, result: uploadResult }
    } catch (e) {
      const errMsg = "Upload fehlgeschlagen."
      setError(errMsg)
      setPhase("error")
      return { ok: false as const, error: errMsg }
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

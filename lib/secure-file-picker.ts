"use client"

export interface PickedFile {
  file: File
  previewUrl?: string
}

const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"]
const MAX_SIZE = 2.5 * 1024 * 1024 // 2.5 MB

/**
 * Öffnet Dateiauswahl (Bilder + PDF). Funktioniert im Web und im Capacitor WebView.
 * Beim Abbrechen des Dialogs wird null zurückgegeben (kein hängendes Promise).
 */
export async function pickFileForChat(): Promise<File | null> {
  return new Promise<File | null>((resolve) => {
    let resolved = false
    const resolveOnce = (value: File | null) => {
      if (resolved) return
      resolved = true
      window.removeEventListener("focus", onFocus)
      clearTimeout(tid)
      resolve(value)
    }

    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/jpeg,image/jpg,image/png,application/pdf"
    input.multiple = false
    input.onchange = () => {
      const file = input.files?.[0]
      resolveOnce(file ?? null)
    }

    const onFocus = () => {
      setTimeout(() => resolveOnce(null), 400)
    }
    window.addEventListener("focus", onFocus)
    const tid = window.setTimeout(() => resolveOnce(null), 60000)

    input.click()
  })
}

export function validateFileForUpload(file: File): { ok: true } | { ok: false; error: string; code: string } {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase()
  const blocked = ["exe", "bat", "cmd", "msi", "scr", "vbs", "js", "jar", "php", "py", "sh", "ps1"]
  if (blocked.includes(ext)) {
    return { ok: false, error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.", code: "TYPE_NOT_ALLOWED" }
  }
  if (!ALLOWED_MIMES.includes(file.type)) {
    return { ok: false, error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.", code: "TYPE_NOT_ALLOWED" }
  }
  if (file.size > MAX_SIZE) {
    return {
      ok: false,
      error: "Tipp: Verkleinere das Bild oder PDF, um die maximale Größe von 2,5 MB einzuhalten.",
      code: "SIZE_EXCEEDED",
    }
  }
  return { ok: true }
}

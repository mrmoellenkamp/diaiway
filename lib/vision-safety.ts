/**
 * Google Cloud Vision API - SafeSearch
 * Prüft Bilder auf explizite Inhalte (adult, violence, racy) vor dem Speichern.
 * Erfordert: GOOGLE_CLOUD_VISION_API_KEY (API-Key mit aktivierter Vision API)
 */
const VISION_API = "https://vision.googleapis.com/v1/images:annotate"
const UNSAFE_LEVELS = ["LIKELY", "VERY_LIKELY"]

export type SafeSearchLevel = "UNKNOWN" | "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY"

interface SafeSearchAnnotation {
  adult?: SafeSearchLevel
  violence?: SafeSearchLevel
  racy?: SafeSearchLevel
  spoof?: SafeSearchLevel
  medical?: SafeSearchLevel
}

export interface SafetyCheckResult {
  safe: boolean
  reason?: string
  /** Welcher Kategorie (adult/violence/racy) Verstoß, falls vorhanden */
  violation?: { key: string; level: string }
}

function checkAnnotation(annotation: SafeSearchAnnotation): SafetyCheckResult {
  for (const [key, level] of Object.entries(annotation)) {
    if (UNSAFE_LEVELS.includes(level as string)) {
      return { safe: false, reason: `Bild enthält möglicherweise ungeeignete Inhalte (${key}).`, violation: { key, level } }
    }
  }
  return { safe: true }
}

export async function checkImageSafety(buffer: Buffer): Promise<{ safe: boolean; reason?: string }> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey?.trim()) return { safe: false, reason: "Bildprüfung nicht konfiguriert." }

  const timeoutMs = 8000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const base64 = buffer.toString("base64")
    const res = await fetch(`${VISION_API}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: "SAFE_SEARCH_DETECTION" }],
        }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      console.error("[Vision] API error:", res.status, await res.text())
      return { safe: false, reason: "Bildprüfung fehlgeschlagen. Bitte versuche es erneut." }
    }
    const data = await res.json()
    const annotation = data?.responses?.[0]?.safeSearchAnnotation as SafeSearchAnnotation | undefined
    if (!annotation) return { safe: false, reason: "Bild konnte nicht geprüft werden." }
    const result = checkAnnotation(annotation)
    return { safe: result.safe, reason: result.reason }
  } catch (err) {
    clearTimeout(timeoutId)
    console.error("[Vision] Safety check failed:", err)
    return { safe: false, reason: "Bildprüfung fehlgeschlagen. Bitte versuche es erneut." }
  }
}

/** Pre-Check & Alert: Prüft Base64-Bild, gibt detailliertes Ergebnis (inkl. violation für Speicherung) */
export async function checkImageSafetyFromBase64(base64: string): Promise<SafetyCheckResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey?.trim()) return { safe: false, reason: "Bildprüfung nicht konfiguriert.", violation: undefined }

  const timeoutMs = 8000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${VISION_API}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64.replace(/^data:image\/\w+;base64,/, "") },
          features: [{ type: "SAFE_SEARCH_DETECTION" }],
        }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      console.error("[Vision] API error:", res.status, await res.text())
      return { safe: false, reason: "Bildprüfung fehlgeschlagen.", violation: undefined }
    }
    const data = await res.json()
    const annotation = data?.responses?.[0]?.safeSearchAnnotation as SafeSearchAnnotation | undefined
    if (!annotation) return { safe: false, reason: "Bild konnte nicht geprüft werden.", violation: undefined }
    return checkAnnotation(annotation)
  } catch (err) {
    clearTimeout(timeoutId)
    console.error("[Vision] Safety check failed:", err)
    return { safe: false, reason: "Bildprüfung fehlgeschlagen.", violation: undefined }
  }
}

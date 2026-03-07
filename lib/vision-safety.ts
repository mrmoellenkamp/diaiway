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

export async function checkImageSafety(buffer: Buffer): Promise<{ safe: boolean; reason?: string }> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  if (!apiKey?.trim()) return { safe: true }

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
    })
    if (!res.ok) {
      console.error("[Vision] API error:", res.status, await res.text())
      return { safe: true }
    }
    const data = await res.json()
    const annotation = data?.responses?.[0]?.safeSearchAnnotation as SafeSearchAnnotation | undefined
    if (!annotation) return { safe: true }

    for (const [key, level] of Object.entries(annotation)) {
      if (UNSAFE_LEVELS.includes(level as string)) {
        return { safe: false, reason: `Bild enthält möglicherweise ungeeignete Inhalte (${key}).` }
      }
    }
    return { safe: true }
  } catch (err) {
    console.error("[Vision] Safety check failed:", err)
    return { safe: true }
  }
}

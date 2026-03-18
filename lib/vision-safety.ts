/**
 * Google Cloud Vision API - SafeSearch
 * Prüft Bilder auf explizite Inhalte (adult, violence, racy) vor dem Speichern.
 * Unterstützt:
 * - GOOGLE_CLOUD_VISION_API_KEY (API-Key)
 * - GOOGLE_VISION_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY (Service Account, Fallback)
 *
 * DSGVO / Art. 44 DSGVO – Drittlandübermittlung:
 * Explizit EU-regionaler Endpunkt (eu-vision.googleapis.com).
 */
const VISION_API = "https://eu-vision.googleapis.com/v1/images:annotate"
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

function hasVisionConfig(): boolean {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()
  if (apiKey) return true
  const projectId = process.env.GOOGLE_VISION_PROJECT_ID?.trim()
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY?.trim()
  return !!(projectId && clientEmail && privateKey)
}

async function runSafeSearchWithClient(content: string): Promise<SafetyCheckResult> {
  const { ImageAnnotatorClient } = await import("@google-cloud/vision")
  const projectId = process.env.GOOGLE_VISION_PROJECT_ID!
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL!
  const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY!.replace(/\\n/g, "\n")
  const client = new ImageAnnotatorClient({
    credentials: { client_email: clientEmail, private_key: privateKey },
    projectId,
    apiEndpoint: "eu-vision.googleapis.com",
  })
  const [response] = await client.annotateImage({
    image: { content },
    features: [{ type: "SAFE_SEARCH_DETECTION" }],
  })
  const annotation = response.safeSearchAnnotation as SafeSearchAnnotation | undefined
  if (!annotation) return { safe: false, reason: "Bild konnte nicht geprüft werden.", violation: undefined }
  return checkAnnotation(annotation)
}

async function runSafeSearchWithApiKey(content: string): Promise<SafetyCheckResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY!
  const res = await fetch(`${VISION_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        image: { content },
        features: [{ type: "SAFE_SEARCH_DETECTION" }],
      }],
    }),
  })
  if (!res.ok) {
    console.error("[Vision] API error:", res.status, await res.text())
    return { safe: false, reason: "Bildprüfung fehlgeschlagen.", violation: undefined }
  }
  const data = await res.json()
  const annotation = data?.responses?.[0]?.safeSearchAnnotation as SafeSearchAnnotation | undefined
  if (!annotation) return { safe: false, reason: "Bild konnte nicht geprüft werden.", violation: undefined }
  return checkAnnotation(annotation)
}

async function withTimeout<T>(promise: Promise<T>, ms: number, errMsg: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errMsg)), ms)
  )
  return Promise.race([promise, timeout])
}

export async function checkImageSafety(buffer: Buffer): Promise<{ safe: boolean; reason?: string }> {
  if (!hasVisionConfig()) return { safe: false, reason: "Bildprüfung nicht konfiguriert." }

  const base64 = buffer.toString("base64")
  const run = () =>
    process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()
      ? runSafeSearchWithApiKey(base64)
      : runSafeSearchWithClient(base64)

  try {
    const result = await withTimeout(run(), 8000, "Timeout")
    return { safe: result.safe, reason: result.reason }
  } catch (err) {
    console.error("[Vision] Safety check failed:", err)
    return { safe: false, reason: "Bildprüfung fehlgeschlagen. Bitte versuche es erneut." }
  }
}

/** Pre-Check & Alert: Prüft Base64-Bild, gibt detailliertes Ergebnis (inkl. violation für Speicherung) */
export async function checkImageSafetyFromBase64(base64: string): Promise<SafetyCheckResult> {
  if (!hasVisionConfig()) return { safe: false, reason: "Bildprüfung nicht konfiguriert.", violation: undefined }

  const content = base64.replace(/^data:image\/\w+;base64,/, "").trim()
  const run = () =>
    process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()
      ? runSafeSearchWithApiKey(content)
      : runSafeSearchWithClient(content)

  try {
    return await withTimeout(run(), 8000, "Timeout")
  } catch (err) {
    console.error("[Vision] Safety check failed:", err)
    return { safe: false, reason: "Bildprüfung fehlgeschlagen.", violation: undefined }
  }
}

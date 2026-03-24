/**
 * Google Cloud Vision API - SafeSearch
 * Merkmalsweise Schwellen (adult, violence, racy, medical, spoof).
 * Unterstützt:
 * - GOOGLE_CLOUD_VISION_API_KEY (API-Key)
 * - GOOGLE_VISION_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY (Service Account, Fallback)
 *
 * DSGVO / Art. 44 DSGVO – Drittlandübermittlung:
 * Explizit EU-regionaler Endpunkt (eu-vision.googleapis.com).
 */
const VISION_API = "https://eu-vision.googleapis.com/v1/images:annotate"

export type SafeSearchLevel = "UNKNOWN" | "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY"

export type SafeSearchCategory = "adult" | "violence" | "racy" | "medical" | "spoof"

/** Mindest-Likelihood für einen Verstoß, oder IGNORED (Merkmal wird nicht gewertet). */
export type CategoryViolationPolicy = SafeSearchLevel | "IGNORED"

const LEVEL_RANK: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
}

/** Google Vision Likelihood-Enum (protobuf) → Name */
const LIKELIHOOD_BY_NUMBER: Record<number, string> = {
  0: "UNKNOWN",
  1: "VERY_UNLIKELY",
  2: "UNLIKELY",
  3: "POSSIBLE",
  4: "LIKELY",
  5: "VERY_LIKELY",
}

/**
 * Produktions-Schwellen: Verstoß, wenn API-Wert ≥ konfigurierte Stufe.
 * adult: LIKELY+ · violence: POSSIBLE+ · racy: nur VERY_LIKELY · medical: LIKELY+ · spoof: ausgeschaltet
 */
export const SAFE_SEARCH_CATEGORY_POLICY: Record<SafeSearchCategory, CategoryViolationPolicy> = {
  adult: "LIKELY",
  violence: "POSSIBLE",
  racy: "VERY_LIKELY",
  medical: "LIKELY",
  spoof: "IGNORED",
}

interface SafeSearchAnnotation {
  adult?: SafeSearchLevel | string | number | unknown
  violence?: SafeSearchLevel | string | number | unknown
  racy?: SafeSearchLevel | string | number | unknown
  spoof?: SafeSearchLevel | string | number | unknown
  medical?: SafeSearchLevel | string | number | unknown
}

export interface SafetyCheckResult {
  safe: boolean
  reason?: string
  violation?: { key: string; level: string }
}

function normalizeLikelihood(level: unknown): string | null {
  if (level == null) return null
  if (typeof level === "string") return level
  if (typeof level === "number") return LIKELIHOOD_BY_NUMBER[level] ?? null
  const name = (level as { name?: string }).name
  if (typeof name === "string") return name
  return null
}

function isViolationForCategory(
  category: string,
  levelRaw: unknown,
  policy: Record<string, CategoryViolationPolicy>
): { violation: true; level: string } | null {
  const rule = policy[category]
  if (rule === undefined || rule === "IGNORED") return null
  const levelStr = normalizeLikelihood(levelRaw)
  if (!levelStr) return null
  const need = LEVEL_RANK[rule]
  const actual = LEVEL_RANK[levelStr]
  if (need === undefined || actual === undefined) return null
  if (actual >= need) return { violation: true, level: levelStr }
  return null
}

function checkAnnotation(
  annotation: SafeSearchAnnotation,
  policy: Record<string, CategoryViolationPolicy>
): SafetyCheckResult {
  for (const [key, levelRaw] of Object.entries(annotation)) {
    const cat = key.toLowerCase()
    const hit = isViolationForCategory(cat, levelRaw, policy)
    if (hit) {
      return {
        safe: false,
        reason: `Bild enthält möglicherweise ungeeignete Inhalte (${cat}).`,
        violation: { key: cat, level: hit.level },
      }
    }
  }
  return { safe: true }
}

export function hasVisionConfig(): boolean {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()
  if (apiKey) return true
  const projectId = process.env.GOOGLE_VISION_PROJECT_ID?.trim()
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY?.trim()
  return !!(projectId && clientEmail && privateKey)
}

/** Für Health-Check: Welche Vision-Konfiguration ist aktiv (ohne Werte). */
export function getVisionConfigStatus(): { configured: boolean; method: "api_key" | "service_account" | null } {
  if (process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()) {
    return { configured: true, method: "api_key" }
  }
  const projectId = process.env.GOOGLE_VISION_PROJECT_ID?.trim()
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY?.trim()
  if (projectId && clientEmail && privateKey) {
    return { configured: true, method: "service_account" }
  }
  return { configured: false, method: null }
}

async function runSafeSearchWithClient(
  content: string,
  policy: Record<string, CategoryViolationPolicy>
): Promise<SafetyCheckResult> {
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
  return checkAnnotation(annotation, policy)
}

async function runSafeSearchWithApiKey(
  content: string,
  policy: Record<string, CategoryViolationPolicy>
): Promise<SafetyCheckResult> {
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
  const ann = data?.responses?.[0]?.safeSearchAnnotation as Record<string, string> | undefined
  if (!ann) return { safe: false, reason: "Bild konnte nicht geprüft werden.", violation: undefined }
  const annotation: SafeSearchAnnotation = {
    adult: ann.adult,
    violence: ann.violence,
    racy: ann.racy,
    spoof: ann.spoof,
    medical: ann.medical,
  }
  return checkAnnotation(annotation, policy)
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
      ? runSafeSearchWithApiKey(base64, SAFE_SEARCH_CATEGORY_POLICY)
      : runSafeSearchWithClient(base64, SAFE_SEARCH_CATEGORY_POLICY)

  try {
    const result = await withTimeout(run(), 8000, "Timeout")
    return { safe: result.safe, reason: result.reason }
  } catch (err) {
    console.error("[Vision] Safety check failed:", err)
    return { safe: false, reason: "Bildprüfung fehlgeschlagen. Bitte versuche es erneut." }
  }
}

export type CheckImageSafetyFromBase64Options = {
  /** Überschreibt einzelne Merkmale (Rest bleibt SAFE_SEARCH_CATEGORY_POLICY). */
  policy?: Partial<Record<SafeSearchCategory, CategoryViolationPolicy>>
}

/** Pre-Check & Alert: Prüft Base64-Bild, gibt detailliertes Ergebnis (inkl. violation für Speicherung) */
export async function checkImageSafetyFromBase64(
  base64: string,
  options?: CheckImageSafetyFromBase64Options
): Promise<SafetyCheckResult> {
  if (!hasVisionConfig()) return { safe: false, reason: "Bildprüfung nicht konfiguriert.", violation: undefined }

  const policy: Record<string, CategoryViolationPolicy> = {
    ...SAFE_SEARCH_CATEGORY_POLICY,
    ...options?.policy,
  }
  const content = base64.replace(/^data:image\/\w+;base64,/, "").trim()
  const run = () =>
    process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim()
      ? runSafeSearchWithApiKey(content, policy)
      : runSafeSearchWithClient(content, policy)

  try {
    return await withTimeout(run(), 8000, "Timeout")
  } catch (err) {
    console.error("[Vision] Safety check failed:", err)
    return { safe: false, reason: "Bildprüfung fehlgeschlagen.", violation: undefined }
  }
}

"use server"

import { ImageAnnotatorClient } from "@google-cloud/vision"

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisionFeature =
  | "labels"
  | "objects"
  | "text"
  | "safeSearch"
  | "colors"
  | "faces"
  | "web"

export interface VisionLabel {
  description: string
  confidence: number
}

export interface VisionObject {
  name: string
  confidence: number
  /** Normalized vertices (0-1), clockwise from top-left */
  box: { x: number; y: number }[]
}

export interface VisionFace {
  confidence: number
  joy: string
  sorrow: string
  anger: string
  surprise: string
  headwear: string
  blurred: string
}

export interface VisionColor {
  hex: string
  r: number
  g: number
  b: number
  score: number
  pixelFraction: number
}

export interface VisionSafeSearch {
  adult: string
  spoof: string
  medical: string
  violence: string
  racy: string
}

export interface VisionWebEntity {
  description: string
  score: number
}

export interface VisionAnalysisResult {
  labels?: VisionLabel[]
  objects?: VisionObject[]
  fullText?: string
  textBlocks?: string[]
  safeSearch?: VisionSafeSearch
  colors?: VisionColor[]
  faces?: VisionFace[]
  webEntities?: VisionWebEntity[]
  webBestGuess?: string[]
  error?: string
}

// ─── Client factory ───────────────────────────────────────────────────────────

function makeClient(): ImageAnnotatorClient | null {
  const projectId = process.env.GOOGLE_VISION_PROJECT_ID
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL
  const privateKeyRaw = process.env.GOOGLE_VISION_PRIVATE_KEY
  if (!projectId || !clientEmail || !privateKeyRaw) return null

  return new ImageAnnotatorClient({
    credentials: {
      client_email: clientEmail,
      private_key: privateKeyRaw.replace(/\\n/g, "\n"),
    },
    projectId,
  })
}

function cleanBase64(input: string): string {
  return input.replace(/^data:image\/\w+;base64,/, "").trim()
}

function likelihoodLabel(val: unknown): string {
  const map: Record<string, string> = {
    UNKNOWN: "Unbekannt",
    VERY_UNLIKELY: "Sehr unwahrscheinlich",
    UNLIKELY: "Unwahrscheinlich",
    POSSIBLE: "Möglich",
    LIKELY: "Wahrscheinlich",
    VERY_LIKELY: "Sehr wahrscheinlich",
  }
  const key = typeof val === "number" ? Object.keys(map)[val] ?? "UNKNOWN" : String(val)
  return map[key] ?? String(val)
}

function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(v ?? 0).toString(16).padStart(2, "0"))
      .join("")
  )
}

// ─── Main Server Action ───────────────────────────────────────────────────────

/**
 * Führt mehrere Google Cloud Vision Analysen in einem einzigen API-Call durch.
 * @param dataUrl  Base64 oder Data-URL des Bildes
 * @param features Liste der gewünschten Features
 */
export async function analyzeImage(
  dataUrl: string,
  features: VisionFeature[]
): Promise<VisionAnalysisResult> {
  const client = makeClient()
  if (!client) {
    return { error: "Google Vision nicht konfiguriert (fehlende ENV-Variablen)" }
  }

  const content = cleanBase64(dataUrl)
  if (!content) return { error: "Kein gültiges Bild übergeben" }

  // Feature-Map: Feature-Name → Vision API Feature-Type
  const featureTypeMap: Record<VisionFeature, string> = {
    labels: "LABEL_DETECTION",
    objects: "OBJECT_LOCALIZATION",
    text: "DOCUMENT_TEXT_DETECTION",
    safeSearch: "SAFE_SEARCH_DETECTION",
    colors: "IMAGE_PROPERTIES",
    faces: "FACE_DETECTION",
    web: "WEB_DETECTION",
  }

  const requestedFeatures = features.map((f) => ({
    type: featureTypeMap[f],
    maxResults: f === "colors" ? 10 : f === "web" ? 10 : 20,
  }))

  try {
    const [response] = await client.annotateImage({
      image: { content },
      features: requestedFeatures,
    })

    const result: VisionAnalysisResult = {}

    // Labels
    if (features.includes("labels") && response.labelAnnotations) {
      result.labels = response.labelAnnotations
        .filter((a) => a.description?.trim())
        .map((a) => ({
          description: a.description!.trim(),
          confidence: typeof a.score === "number" ? Math.round(a.score * 100) : 0,
        }))
    }

    // Objects
    if (features.includes("objects") && response.localizedObjectAnnotations) {
      result.objects = response.localizedObjectAnnotations
        .filter((o) => o.name)
        .map((o) => ({
          name: o.name!,
          confidence: typeof o.score === "number" ? Math.round(o.score * 100) : 0,
          box:
            o.boundingPoly?.normalizedVertices?.map((v) => ({
              x: v.x ?? 0,
              y: v.y ?? 0,
            })) ?? [],
        }))
    }

    // Text / OCR
    if (features.includes("text")) {
      if (response.fullTextAnnotation?.text) {
        result.fullText = response.fullTextAnnotation.text.trim()
      }
      const blocks =
        response.textAnnotations
          ?.slice(1)
          .map((t) => t.description?.trim())
          .filter((d): d is string => !!d) ?? []
      result.textBlocks = blocks
    }

    // Safe Search
    if (features.includes("safeSearch") && response.safeSearchAnnotation) {
      const s = response.safeSearchAnnotation
      result.safeSearch = {
        adult: likelihoodLabel(s.adult),
        spoof: likelihoodLabel(s.spoof),
        medical: likelihoodLabel(s.medical),
        violence: likelihoodLabel(s.violence),
        racy: likelihoodLabel(s.racy),
      }
    }

    // Colors
    if (
      features.includes("colors") &&
      response.imagePropertiesAnnotation?.dominantColors?.colors
    ) {
      result.colors = response.imagePropertiesAnnotation.dominantColors.colors
        .slice(0, 8)
        .map((c) => {
          const r = c.color?.red ?? 0
          const g = c.color?.green ?? 0
          const b = c.color?.blue ?? 0
          return {
            hex: toHex(r, g, b),
            r: Math.round(r),
            g: Math.round(g),
            b: Math.round(b),
            score: typeof c.score === "number" ? Math.round(c.score * 100) : 0,
            pixelFraction:
              typeof c.pixelFraction === "number"
                ? Math.round(c.pixelFraction * 100)
                : 0,
          }
        })
    }

    // Faces
    if (features.includes("faces") && response.faceAnnotations) {
      result.faces = response.faceAnnotations.map((f) => ({
        confidence:
          typeof f.detectionConfidence === "number"
            ? Math.round(f.detectionConfidence * 100)
            : 0,
        joy: likelihoodLabel(f.joyLikelihood),
        sorrow: likelihoodLabel(f.sorrowLikelihood),
        anger: likelihoodLabel(f.angerLikelihood),
        surprise: likelihoodLabel(f.surpriseLikelihood),
        headwear: likelihoodLabel(f.headwearLikelihood),
        blurred: likelihoodLabel(f.blurredLikelihood),
      }))
    }

    // Web
    if (features.includes("web") && response.webDetection) {
      result.webEntities = (response.webDetection.webEntities ?? [])
        .filter((e) => e.description)
        .slice(0, 10)
        .map((e) => ({
          description: e.description!,
          score: typeof e.score === "number" ? Math.round(e.score * 100) : 0,
        }))
      result.webBestGuess = (response.webDetection.bestGuessLabels ?? [])
        .map((l) => l.label)
        .filter((l): l is string => !!l)
    }

    return result
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Vision API Fehler: ${msg}` }
  }
}

// ─── Legacy: einzelner Label-Call (Abwärtskompatibilität) ─────────────────────

export type VisionResult = { ok: true; labels: VisionLabel[] } | { ok: false; error: string }

export async function detectImageLabels(base64Image: string): Promise<VisionResult> {
  const result = await analyzeImage(base64Image, ["labels"])
  if (result.error) return { ok: false, error: result.error }
  return { ok: true, labels: result.labels ?? [] }
}

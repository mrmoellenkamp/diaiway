import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ImageAnnotatorClient } from "@google-cloud/vision"

export const runtime = "nodejs"

function makeClient(): ImageAnnotatorClient | null {
  const projectId   = process.env.GOOGLE_VISION_PROJECT_ID
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL
  const privateKey  = process.env.GOOGLE_VISION_PRIVATE_KEY
  if (!projectId || !clientEmail || !privateKey) return null
  return new ImageAnnotatorClient({
    credentials: {
      client_email: clientEmail,
      private_key:  privateKey.replace(/\\n/g, "\n"),
    },
    projectId,
  })
}

function likelihoodLabel(val: unknown): string {
  const map: Record<string, string> = {
    UNKNOWN:       "Unbekannt",
    VERY_UNLIKELY: "Sehr unwahrscheinlich",
    UNLIKELY:      "Unwahrscheinlich",
    POSSIBLE:      "Möglich",
    LIKELY:        "Wahrscheinlich",
    VERY_LIKELY:   "Sehr wahrscheinlich",
  }
  const key = typeof val === "number" ? Object.keys(map)[val] ?? "UNKNOWN" : String(val)
  return map[key] ?? String(val)
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(v ?? 0).toString(16).padStart(2, "0")).join("")
}

export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  let body: { dataUrl?: string; features?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 })
  }

  const { dataUrl, features = ["labels"] } = body
  if (!dataUrl) return NextResponse.json({ error: "Kein Bild übergeben." }, { status: 400 })

  const client = makeClient()
  if (!client) {
    return NextResponse.json({ error: "Google Vision nicht konfiguriert (fehlende ENV-Variablen)." }, { status: 500 })
  }

  const content = dataUrl.replace(/^data:image\/\w+;base64,/, "").trim()

  const featureTypeMap: Record<string, string> = {
    labels:     "LABEL_DETECTION",
    objects:    "OBJECT_LOCALIZATION",
    text:       "DOCUMENT_TEXT_DETECTION",
    safeSearch: "SAFE_SEARCH_DETECTION",
    colors:     "IMAGE_PROPERTIES",
    faces:      "FACE_DETECTION",
    web:        "WEB_DETECTION",
  }

  const requestedFeatures = features.map((f) => ({
    type:       featureTypeMap[f] ?? "LABEL_DETECTION",
    maxResults: f === "colors" || f === "web" ? 10 : 20,
  }))

  try {
    const [response] = await client.annotateImage({
      image:    { content },
      features: requestedFeatures,
    })

    // Explicitly build a plain-JSON-serializable result object
    const result: Record<string, unknown> = {}

    if (features.includes("labels") && response.labelAnnotations) {
      result.labels = response.labelAnnotations
        .filter((a) => a.description?.trim())
        .map((a) => ({
          description: String(a.description ?? "").trim(),
          confidence:  typeof a.score === "number" ? Math.round(a.score * 100) : 0,
        }))
    }

    if (features.includes("objects") && response.localizedObjectAnnotations) {
      result.objects = response.localizedObjectAnnotations
        .filter((o) => o.name)
        .map((o) => ({
          name:       String(o.name ?? ""),
          confidence: typeof o.score === "number" ? Math.round(o.score * 100) : 0,
          box: (o.boundingPoly?.normalizedVertices ?? []).map((v) => ({
            x: Number(v.x ?? 0),
            y: Number(v.y ?? 0),
          })),
        }))
    }

    if (features.includes("text")) {
      result.fullText    = response.fullTextAnnotation?.text?.trim() ?? ""
      result.textBlocks  = (response.textAnnotations ?? [])
        .slice(1)
        .map((t) => String(t.description ?? "").trim())
        .filter(Boolean)
    }

    if (features.includes("safeSearch") && response.safeSearchAnnotation) {
      const s = response.safeSearchAnnotation
      result.safeSearch = {
        adult:    likelihoodLabel(s.adult),
        spoof:    likelihoodLabel(s.spoof),
        medical:  likelihoodLabel(s.medical),
        violence: likelihoodLabel(s.violence),
        racy:     likelihoodLabel(s.racy),
      }
    }

    if (features.includes("colors") && response.imagePropertiesAnnotation?.dominantColors?.colors) {
      result.colors = response.imagePropertiesAnnotation.dominantColors.colors
        .slice(0, 8)
        .map((c) => {
          const r = Number(c.color?.red ?? 0)
          const g = Number(c.color?.green ?? 0)
          const b = Number(c.color?.blue ?? 0)
          return {
            hex:          toHex(r, g, b),
            r:            Math.round(r),
            g:            Math.round(g),
            b:            Math.round(b),
            score:        typeof c.score === "number" ? Math.round(c.score * 100) : 0,
            pixelFraction: typeof c.pixelFraction === "number" ? Math.round(c.pixelFraction * 100) : 0,
          }
        })
    }

    if (features.includes("faces") && response.faceAnnotations) {
      result.faces = response.faceAnnotations.map((f) => ({
        confidence: typeof f.detectionConfidence === "number" ? Math.round(f.detectionConfidence * 100) : 0,
        joy:        likelihoodLabel(f.joyLikelihood),
        sorrow:     likelihoodLabel(f.sorrowLikelihood),
        anger:      likelihoodLabel(f.angerLikelihood),
        surprise:   likelihoodLabel(f.surpriseLikelihood),
        headwear:   likelihoodLabel(f.headwearLikelihood),
        blurred:    likelihoodLabel(f.blurredLikelihood),
      }))
    }

    if (features.includes("web") && response.webDetection) {
      result.webEntities = (response.webDetection.webEntities ?? [])
        .filter((e) => e.description)
        .slice(0, 10)
        .map((e) => ({
          description: String(e.description ?? ""),
          score:       typeof e.score === "number" ? Math.round(e.score * 100) : 0,
        }))
      result.webBestGuess = (response.webDetection.bestGuessLabels ?? [])
        .map((l) => String(l.label ?? ""))
        .filter(Boolean)
    }

    // JSON.parse(JSON.stringify()) ensures plain object without any prototype chains
    return NextResponse.json(JSON.parse(JSON.stringify(result)))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Vision API Fehler: ${msg}` }, { status: 500 })
  }
}

import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import sharp from "sharp"
import Busboy from "busboy"
import { Readable } from "stream"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 2.5 * 1024 * 1024 // 2.5 MB
const THUMBNAIL_MAX_PX = 200
const CLOUDMERSIVE_TIMEOUT_MS = 30_000

/** Allowed types per requirements: PDF, JPG, PNG only */
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
])

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "scr", "vbs", "js", "jar",
  "php", "py", "sh", "ps1", "dll", "so", "dylib",
])

// ─── Response Interfaces ────────────────────────────────────────────────────

interface SuccessResponse {
  url: string
  thumbnailUrl: string | null
  filename: string
}

interface ErrorResponse {
  error: string
  code: "NO_FILE" | "FILE_TOO_LARGE" | "INVALID_TYPE" | "VIRUS_DETECTED" | "API_TIMEOUT" | "UPLOAD_FAILED"
}

// ─── Virus Scan ─────────────────────────────────────────────────────────────

interface CloudmersiveResult {
  CleanResult?: boolean
  FoundViruses?: Array<{ FileName?: string; VirusName?: string }>
}

async function scanWithCloudmersive(buffer: Buffer): Promise<{ clean: boolean }> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY
  if (!apiKey) {
    console.warn("[secure-upload] CLOUDMERSIVE_API_KEY not set – skipping virus scan")
    return { clean: true }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CLOUDMERSIVE_TIMEOUT_MS)

  try {
    const formData = new FormData()
    formData.append("inputFile", new Blob([buffer]), "scan.bin")

    const res = await fetch("https://api.cloudmersive.com/virus/scan/file", {
      method: "POST",
      headers: { Apikey: apiKey },
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const err = await res.text()
      console.error("[secure-upload] Cloudmersive API error:", res.status, err)
      throw new Error("API_TIMEOUT")
    }

    const data = (await res.json()) as CloudmersiveResult
    return { clean: data.CleanResult === true }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("API_TIMEOUT")
    }
    throw err
  }
}

// ─── Thumbnail ──────────────────────────────────────────────────────────────

async function generateThumbnail(buffer: Buffer, mime: string): Promise<Buffer | null> {
  if (!mime.startsWith("image/")) return null
  try {
    return await sharp(buffer)
      .resize(THUMBNAIL_MAX_PX, THUMBNAIL_MAX_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    return null
  }
}

// ─── Multipart Stream Parser (Busboy) ────────────────────────────────────────

interface ParsedFile {
  buffer: Buffer
  mime: string
  originalFilename: string
}

function parseMultipartStream(request: NextRequest): Promise<ParsedFile | null> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      reject(new Error("INVALID_TYPE"))
      return
    }

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: MAX_SIZE_BYTES },
    })

    let parsedFile: ParsedFile | null = null
    const chunks: Buffer[] = []
    let byteCount = 0
    let fileLimitReached = false
    let settled = false

    const settle = (fn: () => void, value: ParsedFile | null) => {
      if (settled) return
      settled = true
      fn()
      if (nodeStream && !nodeStream.destroyed) nodeStream.destroy()
    }

    let nodeStream: Readable | null = null

    busboy.on("file", (fieldname, file, info) => {
      if (fieldname !== "file") {
        file.resume()
        return
      }

      const { mimeType, filename } = info
      const mime = (mimeType || "").toLowerCase().trim()
      const ext = (filename?.split(".").pop() ?? "").toLowerCase()

      if (BLOCKED_EXTENSIONS.has(ext)) {
        file.resume()
        settle(() => reject(new Error("INVALID_TYPE")), null)
        return
      }

      if (!ALLOWED_MIMES.has(mime)) {
        file.resume()
        settle(() => reject(new Error("INVALID_TYPE")), null)
        return
      }

      file.on("limit", () => {
        fileLimitReached = true
        settle(() => reject(new Error("FILE_TOO_LARGE")), null)
      })

      file.on("data", (chunk: Buffer) => {
        if (fileLimitReached || settled) return
        byteCount += chunk.length
        if (byteCount > MAX_SIZE_BYTES) {
          fileLimitReached = true
          settle(() => reject(new Error("FILE_TOO_LARGE")), null)
          return
        }
        chunks.push(chunk)
      })

      file.on("error", (err) => {
        if (!settled) {
          settle(() => reject(fileLimitReached ? new Error("FILE_TOO_LARGE") : err), null)
        }
      })

      file.on("end", () => {
        if (settled || fileLimitReached) return
        parsedFile = {
          buffer: Buffer.concat(chunks),
          mime,
          originalFilename: filename || "file",
        }
      })
    })

    busboy.on("finish", () => {
      if (settled) return
      settled = true
      resolve(parsedFile)
    })

    busboy.on("error", (err) => {
      if (!settled) {
        settled = true
        if (nodeStream && !nodeStream.destroyed) nodeStream.destroy()
        reject(err)
      }
    })

    const body = request.body
    if (!body) {
      reject(new Error("NO_FILE"))
      return
    }

    nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream)
    nodeStream.on("error", (err) => {
      if (!settled) {
        settled = true
        reject(err)
      }
    })
    nodeStream.pipe(busboy)
  })
}

// ─── Response Helpers ───────────────────────────────────────────────────────

function jsonError(response: ErrorResponse, status: number) {
  return NextResponse.json(response, { status })
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet.", code: "UPLOAD_FAILED" } satisfies ErrorResponse, { status: 401 })
    }

    const parsed = await parseMultipartStream(request)

    if (!parsed) {
      return jsonError(
        {
          error: "Keine Datei gesendet oder Datei zu groß.",
          code: "NO_FILE",
        },
        400
      )
    }

    const { buffer, mime, originalFilename } = parsed

    if (buffer.length > MAX_SIZE_BYTES) {
      return jsonError(
        {
          error: "Tipp: Verkleinere das Bild oder PDF, um die maximale Größe von 2,5 MB einzuhalten.",
          code: "FILE_TOO_LARGE",
        },
        400
      )
    }

    const ext = (originalFilename.split(".").pop() ?? "").toLowerCase()
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return jsonError(
        {
          error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.",
          code: "INVALID_TYPE",
        },
        400
      )
    }

    if (!ALLOWED_MIMES.has(mime)) {
      return jsonError(
        {
          error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.",
          code: "INVALID_TYPE",
        },
        400
      )
    }

    let clean: boolean
    try {
      const scanResult = await scanWithCloudmersive(buffer)
      clean = scanResult.clean
    } catch (err) {
      const msg = (err as Error)?.message ?? ""
      if (msg === "API_TIMEOUT") {
        return jsonError(
          {
            error: "Sicherheitsprüfung hat zu lange gedauert. Bitte versuche es erneut.",
            code: "API_TIMEOUT",
          },
          503
        )
      }
      return jsonError(
        {
          error: "Sicherheitsprüfung fehlgeschlagen.",
          code: "API_TIMEOUT",
        },
        503
      )
    }

    if (!clean) {
      return jsonError(
        {
          error:
            "Datei konnte nicht verarbeitet werden: Das Dokument entspricht nicht unseren Sicherheitsrichtlinien oder ist beschädigt.",
          code: "VIRUS_DETECTED",
        },
        403
      )
    }

    const uuid = randomUUID()
    const extSafe =
      mime === "application/pdf"
        ? "pdf"
        : mime === "image/png"
          ? "png"
          : mime.startsWith("image/jpeg") || mime.startsWith("image/jpg")
            ? "jpg"
            : "bin"
    const baseName = `secure-files/${session.user.id}-${uuid}`

    const mainBlob = await put(`${baseName}.${extSafe}`, buffer, {
      access: "public",
      contentType: mime,
    })

    let thumbnailUrl: string | null = null
    const thumbBuf = await generateThumbnail(buffer, mime)
    if (thumbBuf) {
      const thumbBlob = await put(`${baseName}-thumb.jpg`, thumbBuf, {
        access: "public",
        contentType: "image/jpeg",
      })
      thumbnailUrl = thumbBlob.url
    }

    const safeDisplayName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)

    const successResponse: SuccessResponse = {
      url: mainBlob.url,
      thumbnailUrl,
      filename: safeDisplayName,
    }

    return NextResponse.json(successResponse)
  } catch (err) {
    const msg = (err as Error)?.message ?? ""
    console.error("[secure-upload] error:", msg)

    if (msg === "FILE_TOO_LARGE") {
      return jsonError(
        {
          error: "Tipp: Verkleinere das Bild oder PDF, um die maximale Größe von 2,5 MB einzuhalten.",
          code: "FILE_TOO_LARGE",
        },
        400
      )
    }

    if (msg === "INVALID_TYPE") {
      return jsonError(
        {
          error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.",
          code: "INVALID_TYPE",
        },
        400
      )
    }

    if (msg === "NO_FILE") {
      return jsonError(
        { error: "Keine Datei gesendet.", code: "NO_FILE" },
        400
      )
    }

    return jsonError(
      { error: "Upload fehlgeschlagen.", code: "UPLOAD_FAILED" },
      500
    )
  }
}

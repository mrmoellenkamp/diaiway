import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import sharp from "sharp"

export const runtime = "nodejs"

const MAX_SIZE_BYTES = 2.5 * 1024 * 1024 // 2,5 MB
const THUMBNAIL_MAX_PX = 200

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
])

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "scr", "vbs", "js", "jar",
  "php", "py", "sh", "ps1", "dll", "so", "dylib",
])

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
  const ext = (base.split(".").pop() ?? "").toLowerCase()
  if (BLOCKED_EXTENSIONS.has(ext)) return ""
  return base
}

async function scanWithCloudmersive(buffer: Buffer, filename: string): Promise<{ clean: boolean }> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY
  if (!apiKey) {
    console.warn("[secure-upload] CLOUDMERSIVE_API_KEY fehlt – Überspringe Virenscan")
    return { clean: true }
  }

  const formData = new FormData()
  formData.append("inputFile", new Blob([buffer]), filename)

  const res = await fetch("https://api.cloudmersive.com/virus/scan/file", {
    method: "POST",
    headers: { Apikey: apiKey },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[secure-upload] Cloudmersive error:", res.status, err)
    throw new Error("Sicherheitsprüfung fehlgeschlagen.")
  }

  const data = (await res.json()) as { CleanResult?: boolean }
  return { clean: data.CleanResult === true }
}

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "Keine Datei gesendet.", code: "NO_FILE" },
        { status: 400 }
      )
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase()
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.",
          code: "TYPE_NOT_ALLOWED",
        },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json(
        {
          error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.",
          code: "TYPE_NOT_ALLOWED",
        },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "Tipp: Verkleinere das Bild oder PDF, um die maximale Größe von 2,5 MB einzuhalten.",
          code: "SIZE_EXCEEDED",
        },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const sanitized = sanitizeFilename(file.name)
    if (!sanitized) {
      return NextResponse.json(
        {
          error: "Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.",
          code: "TYPE_NOT_ALLOWED",
        },
        { status: 400 }
      )
    }

    const { clean } = await scanWithCloudmersive(buffer, sanitized)
    if (!clean) {
      return NextResponse.json(
        {
          error:
            "Datei konnte nicht verarbeitet werden: Das Dokument entspricht nicht unseren Sicherheitsrichtlinien oder ist beschädigt.",
          code: "SECURITY_BLOCKED",
        },
        { status: 400 }
      )
    }

    const extSafe = ext || (file.type.includes("pdf") ? "pdf" : "bin")
    const baseName = `secure-files/${session.user.id}-${Date.now()}`

    const mainBlob = await put(`${baseName}.${extSafe}`, buffer, {
      access: "public",
      contentType: file.type,
    })

    let thumbnailUrl: string | null = null
    const thumbBuf = await generateThumbnail(buffer, file.type)
    if (thumbBuf) {
      const thumbBlob = await put(`${baseName}-thumb.jpg`, thumbBuf, {
        access: "public",
        contentType: "image/jpeg",
      })
      thumbnailUrl = thumbBlob.url
    }

    return NextResponse.json({
      url: mainBlob.url,
      thumbnailUrl,
      filename: sanitized,
    })
  } catch (err) {
    const msg = (err as Error)?.message ?? ""
    console.error("[secure-upload] error:", msg)
    if (msg.includes("Sicherheitsprüfung")) {
      return NextResponse.json(
        {
          error:
            "Datei konnte nicht verarbeitet werden: Das Dokument entspricht nicht unseren Sicherheitsrichtlinien oder ist beschädigt.",
          code: "SECURITY_BLOCKED",
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Upload fehlgeschlagen.", code: "UPLOAD_FAILED" }, { status: 500 })
  }
}

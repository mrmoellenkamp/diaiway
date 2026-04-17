import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { auth } from "@/lib/auth"
import { optimizeImageForUpload } from "@/lib/image-compress"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { uploadFolderSchema } from "@/lib/schemas/upload"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"

/** Vercel Serverless: Request-Body hart begrenzt (~4,5 MB). Client komprimiert vorher. */
export const maxDuration = 60

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"])
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/**
 * SECURITY: Magic-Byte-Prüfung via sharp.  Der vom Client gesendete `file.type`
 * (Content-Type) ist vertrauensunwürdig — ein Angreifer kann z. B. eine .exe
 * als `image/png` markieren.  sharp liest die echten Bild-Header und liefert
 * das tatsächliche Format. Nur dieses Ergebnis wird für die Speicherung
 * akzeptiert.
 */
async function assertRealImage(buffer: Buffer): Promise<{ ok: true; format: string } | { ok: false }> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata()
    const fmt = meta.format
    if (!fmt) return { ok: false }
    if (!["jpeg", "jpg", "png", "webp", "gif"].includes(fmt)) return { ok: false }
    return { ok: true, format: fmt }
  } catch {
    return { ok: false }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    // 40 Bild-Uploads pro Stunde (userId+IP). Größere Batches eher selten.
    const rl = await assertRateLimit(
      { req: request, userId: session.user.id },
      { bucket: "upload:image", limit: 40, windowSec: 3600 }
    )
    if (rl) return rl

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folderRaw = (formData.get("folder") as string | null) ?? "uploads"

    if (!file) {
      return NextResponse.json({ error: "Keine Datei gesendet." }, { status: 400 })
    }

    const folderParsed = uploadFolderSchema.safeParse(folderRaw)
    const folder = folderParsed.success ? folderParsed.data : "uploads"

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Nur JPG, PNG, WebP und GIF erlaubt." },
        { status: 400 }
      )
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Maximale Upload-Größe: ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)

    // SECURITY: Echten Bild-Header prüfen (Magic Bytes), nicht dem Client-MIME vertrauen.
    const magic = await assertRealImage(buffer)
    if (!magic.ok) {
      return NextResponse.json(
        { error: "Datei ist kein gültiges Bild." },
        { status: 400 }
      )
    }

    let contentType = ALLOWED_TYPES.has(file.type) ? file.type : "image/jpeg"

    try {
      const optimized = await optimizeImageForUpload(buffer, contentType)
      buffer = Buffer.from(optimized.buffer)
      contentType = optimized.contentType
    } catch (err) {
      logSecureError("upload.optimize", err)
      return NextResponse.json(
        {
          error:
            "Bild konnte nicht verarbeitet werden. Bitte JPG, PNG, WebP oder GIF verwenden oder eine andere Datei wählen.",
        },
        { status: 400 }
      )
    }

    const ext =
      contentType === "image/jpeg"
        ? "jpg"
        : (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")
    const filename = `${folder}/${session.user.id}-${Date.now()}.${ext}`

    const blobPromise = put(filename, buffer, { access: "public", contentType })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Upload timeout")), 25000)
    )
    const blob = await Promise.race([blobPromise, timeoutPromise])

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    const msg = (error as Error)?.message ?? ""
    logSecureError("upload", error)
    if (msg.includes("does not exist") || msg.includes("store")) {
      return NextResponse.json(
        {
          error:
            "Blob-Store nicht gefunden. Bitte in Vercel einen neuen Blob Store (Public) anlegen und BLOB_READ_WRITE_TOKEN mit dem neuen Token aktualisieren.",
        },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: "Upload fehlgeschlagen." }, { status: 500 })
  }
}

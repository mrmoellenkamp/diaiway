import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { optimizeImageForUpload } from "@/lib/image-compress"

export const runtime = "nodejs"

/** Vercel Serverless: Request-Body hart begrenzt (~4,5 MB). Client komprimiert vorher. */
export const maxDuration = 60

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4 MiB – unter Vercel-Limit inkl. Multipart-Rand
const ALLOWED_FOLDERS = ["profiles", "experts", "uploads", "shugyo-projects", "takumi-portfolio"]

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folderRaw = (formData.get("folder") as string | null) ?? "uploads"

    if (!file) {
      return NextResponse.json({ error: "Keine Datei gesendet." }, { status: 400 })
    }

    // Sanitize folder param — only allow known values
    const folder = ALLOWED_FOLDERS.includes(folderRaw) ? folderRaw : "uploads"

    if (!ALLOWED_TYPES.includes(file.type)) {
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
    let contentType = ALLOWED_TYPES.includes(file.type) ? file.type : "image/jpeg"

    // Immer optimieren: EXIF, max. 2048px, JPEG; bei Bedarf weiter unter 5 MB komprimieren
    try {
      const optimized = await optimizeImageForUpload(buffer, contentType)
      buffer = Buffer.from(optimized.buffer)
      contentType = optimized.contentType
    } catch (err) {
      console.error("[diAiway] Bildoptimierung fehlgeschlagen:", err)
      return NextResponse.json(
        {
          error:
            "Bild konnte nicht verarbeitet werden. Bitte JPG, PNG, WebP oder GIF verwenden oder eine andere Datei wählen.",
        },
        { status: 400 }
      )
    }

    const ext = contentType === "image/jpeg" ? "jpg" : (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")
    const filename = `${folder}/${session.user.id}-${Date.now()}.${ext}`

    const blobPromise = put(filename, buffer, { access: "public", contentType })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Upload timeout")), 25000)
    )
    const blob = await Promise.race([blobPromise, timeoutPromise])

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    const msg = (error as Error)?.message ?? ""
    console.error("[diAiway] Upload error:", msg)
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

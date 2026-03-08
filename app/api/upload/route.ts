import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkImageSafety } from "@/lib/vision-safety"

export const runtime = "nodejs"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
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

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Maximale Dateigröße: 5 MB." },
        { status: 400 }
      )
    }

    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")
    const filename = `${folder}/${session.user.id}-${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const { safe, reason } = await checkImageSafety(buffer)
    if (!safe) {
      return NextResponse.json({ error: reason ?? "Bild enthält ungeeignete Inhalte." }, { status: 400 })
    }

    const contentType = ALLOWED_TYPES.includes(file.type) ? file.type : "image/jpeg"
    const blob = await put(filename, buffer, { access: "public", contentType })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    const err = error as Error
    console.error("[diAiway] Upload error:", err?.message ?? err)
    const msg =
      err?.message?.toLowerCase().includes("blob") || err?.message?.toLowerCase().includes("token")
        ? "Blob-Speicher nicht konfiguriert. Bitte BLOB_READ_WRITE_TOKEN prüfen."
        : "Upload fehlgeschlagen."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { put } from "@vercel/blob"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { compressImageToMaxSize } from "@/lib/image-compress"

export const runtime = "nodejs"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const MAX_SIZE_BYTES = 512 * 1024
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** POST /api/admin/invoice-branding/logo — Logo für PDF-Rechnungen (Vercel Blob). */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== "admin") {
    return NextResponse.json({ error: "Kein Admin." }, { status: 403 })
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== "admin") {
    return NextResponse.json({ error: "Kein Admin." }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "Keine Datei." }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Nur JPG, PNG, WebP." }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Datei zu groß." }, { status: 400 })
    }

    let buffer = Buffer.from(await file.arrayBuffer())
    let contentType = file.type
    if (buffer.length > MAX_SIZE_BYTES) {
      const compressed = await compressImageToMaxSize(buffer, MAX_SIZE_BYTES, contentType)
      buffer = Buffer.from(compressed.buffer)
      contentType = compressed.contentType
    }

    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"
    const filename = `invoice-branding/logo-${Date.now()}.${ext}`
    const blob = await put(filename, buffer, { access: "public", contentType })

    return NextResponse.json({ url: blob.url })
  } catch (err: unknown) {
    console.error("[invoice-branding/logo POST]", err)
    return NextResponse.json({ error: "Upload fehlgeschlagen." }, { status: 500 })
  }
}

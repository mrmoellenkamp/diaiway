"use client"

/**
 * Vercel Serverless: Request-Body max. ca. 4,5 MB — große Multipart-Uploads scheitern ohne Client-Kompression.
 * Rohfotos bis MAX_RAW_IMAGE_BYTES wählen, dann hier auf ein kleines JPEG reduzieren, danach POST /api/upload.
 */
export const MAX_RAW_IMAGE_BYTES = 25 * 1024 * 1024

/** Zielgröße für den HTTP-Request (Puffer unter Vercel-Limit inkl. Multipart-Rand) */
const TARGET_REQUEST_BYTES = 3.5 * 1024 * 1024

const MAX_FIRST_PASS_DIM = 2048

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht erzeugt werden."))),
      "image/jpeg",
      quality
    )
  })
}

/**
 * Skaliert auf maxDim (längere Kante), JPEG mit absteigender Qualität.
 * Verkleinert maxDim bei Bedarf, bis TARGET_REQUEST_BYTES erreicht ist.
 */
export async function compressImageFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file
  }

  if (file.size < 180_000 && file.type === "image/jpeg") {
    return file
  }

  const bitmap = await createImageBitmap(file)

  try {
    const canvas = document.createElement("canvas")
    let maxDim = MAX_FIRST_PASS_DIM

    while (maxDim >= 320) {
      const w = bitmap.width
      const h = bitmap.height
      const scale = Math.min(maxDim / Math.max(w, h), 1)
      const bw = Math.max(1, Math.round(w * scale))
      const bh = Math.max(1, Math.round(h * scale))
      canvas.width = bw
      canvas.height = bh
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas nicht verfügbar.")
      ctx.drawImage(bitmap, 0, 0, bw, bh)

      for (let q = 0.88; q >= 0.42; q -= 0.06) {
        const blob = await canvasToJpegBlob(canvas, q)
        if (blob.size <= TARGET_REQUEST_BYTES) {
          return new File([blob], "upload.jpg", { type: "image/jpeg", lastModified: Date.now() })
        }
      }

      maxDim = Math.floor(maxDim * 0.82)
    }

    throw new Error("Bild konnte nicht klein genug komprimiert werden.")
  } finally {
    bitmap.close()
  }
}

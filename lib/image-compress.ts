import sharp from "sharp"

const MAX_DIMENSION_PX = 2048
const MIN_QUALITY = 60

/**
 * Komprimiert ein Bild so, dass es unter maxSizeBytes passt.
 * Reduziert Auflösung (max 2048px) und JPEG-Qualität iterativ.
 * Gibt JPEG zurück (beste Kompression für Fotos).
 */
export async function compressImageToMaxSize(
  buffer: Buffer,
  maxSizeBytes: number,
  mime: string
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!mime.startsWith("image/")) {
    throw new Error("Nur Bilder können komprimiert werden")
  }

  let img = sharp(buffer)
  const meta = await img.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0

  // Bereits klein genug
  if (buffer.length <= maxSizeBytes) {
    return { buffer, contentType: mime }
  }

  // Skalierungsfaktor: max 2048px pro Seite
  let scale = 1
  if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
    const scaleW = width > 0 ? MAX_DIMENSION_PX / width : 1
    const scaleH = height > 0 ? MAX_DIMENSION_PX / height : 1
    scale = Math.min(scaleW, scaleH, 1)
  }

  for (let quality = 85; quality >= MIN_QUALITY; quality -= 10) {
    let pipeline = sharp(buffer)
    if (scale < 1) {
      pipeline = pipeline.resize(Math.round(width * scale), Math.round(height * scale), {
        fit: "inside",
        withoutEnlargement: true,
      })
    }
    const out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer()

    if (out.length <= maxSizeBytes) {
      return { buffer: out, contentType: "image/jpeg" }
    }
  }

  // Letzter Versuch: stärkere Verkleinerung
  const out = await sharp(buffer)
    .resize(MAX_DIMENSION_PX, MAX_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: MIN_QUALITY, mozjpeg: true })
    .toBuffer()

  if (out.length <= maxSizeBytes) {
    return { buffer: out, contentType: "image/jpeg" }
  }

  throw new Error(`Bild konnte nicht unter ${(maxSizeBytes / 1024 / 1024).toFixed(1)} MB komprimiert werden.`)
}

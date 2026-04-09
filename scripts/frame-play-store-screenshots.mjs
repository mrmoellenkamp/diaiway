/**
 * Skaliert Android-/Emulator-Screenshots auf 1080×1920 (9:16) für Google Play **Telefon**
 * und legt einen neutralen „Geräte“-Rahmen (abgerundetes Display auf Hintergrund).
 *
 * **Tablet**-Listings sind separat – siehe `frame-play-store-tablet-screenshots.mjs` (1920×1200).
 *
 * Nutzung: node scripts/frame-play-store-screenshots.mjs
 * Eingabe:  assets/Screenshot_*.png
 * Ausgabe: assets/play-store-screenshots/*.png
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const IN_DIR = path.join(ROOT, "assets")
const OUT_DIR = path.join(ROOT, "assets", "play-store-screenshots")

const OUT_W = 1080
const OUT_H = 1920
/** Rand zum „Gehäuse“ */
const PAD_X = 48
const PAD_Y = 88
/** Abgerundete Display-Ecken */
const RADIUS = 44
/** Dezente Umrandung (px) */
const STROKE = 3

const BG = { r: 250, g: 250, b: 249 }
const STROKE_COLOR = { r: 6, g: 78, b: 59, alpha: 0.22 }

function innerSize() {
  const w = OUT_W - PAD_X * 2
  const h = OUT_H - PAD_Y * 2
  return { w, h }
}

function roundedMaskSvg(w, h, r) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="white"/>
    </svg>`
  )
}

/** Dünner Rahmen auf dem abgerundeten Rechteck */
function strokeOverlaySvg(w, h, r, stroke, color) {
  const sw = stroke
  const inset = sw / 2
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${inset}" y="${inset}" width="${w - sw}" height="${h - sw}" rx="${r - inset}" ry="${r - inset}"
        fill="none" stroke="rgba(${color.r},${color.g},${color.b},${color.alpha})" stroke-width="${sw}"/>
    </svg>`
  )
}

async function processPng(filename) {
  const inputPath = path.join(IN_DIR, filename)
  const { w: innerW, h: innerH } = innerSize()

  const resized = await sharp(inputPath)
    .rotate()
    .resize(innerW, innerH, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .composite([
      {
        input: roundedMaskSvg(innerW, innerH, RADIUS),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer()

  const withStroke = await sharp(resized)
    .composite([
      {
        input: strokeOverlaySvg(innerW, innerH, RADIUS, STROKE, STROKE_COLOR),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer()

  const outName = filename.replace(/\.png$/i, "-1080x1920.png")
  const outPath = path.join(OUT_DIR, outName)

  await sharp({
    create: {
      width: OUT_W,
      height: OUT_H,
      channels: 3,
      background: BG,
    },
  })
    .composite([
      {
        input: withStroke,
        left: PAD_X,
        top: PAD_Y,
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  return outPath
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const files = fs
    .readdirSync(IN_DIR)
    .filter((f) => /^Screenshot_.*\.png$/i.test(f))
    .sort()

  if (files.length === 0) {
    console.error("Keine assets/Screenshot_*.png gefunden.")
    process.exit(1)
  }

  console.log(`${files.length} Screenshot(s) → ${OUT_W}×${OUT_H} px mit Rahmen\n`)
  for (const f of files) {
    const out = await processPng(f)
    console.log("OK", f, "→", path.relative(ROOT, out))
  }
  console.log(`\nFertig: ${path.relative(ROOT, OUT_DIR)}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

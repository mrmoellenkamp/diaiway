/**
 * Exportiert Tablet-Screenshots für Google Play Console (7" und 10" Slots).
 *
 * Quelle: assets/Tablet 10"/*.png (Emulator-Aufnahmen)
 * - 10": 2560×1600 (16:10) – typisch für größere Tablets / Pixel-Tablet-Klasse
 * - 7": 1920×1200 (16:10, kurze Kante ≥1080 px) – eigener Upload-Bereich in der Console
 *
 * PNGs werden ohne Transparenz ausgegeben (Alpha → Hintergrund), Play-kompatibel.
 *
 * Nutzung: node scripts/export-play-tablet-7-10.mjs
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const SRC_DIR = path.join(ROOT, "assets", 'Tablet 10"')
const OUT_10 = path.join(ROOT, "assets", "play-store-tablet-10in")
const OUT_7 = path.join(ROOT, "assets", "play-store-tablet-7in")

const W10 = 2560
const H10 = 1600
const W7 = 1920
const H7 = 1200
/** Neutral wie andere Play-Framing-Skripte */
const BG = { r: 250, g: 250, b: 249 }

async function processOne(filename) {
  const inputPath = path.join(SRC_DIR, filename)
  const base = filename.replace(/\.png$/i, "")

  const buf10 = await sharp(inputPath)
    .rotate()
    .resize(W10, H10, { fit: "cover", position: "centre" })
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toBuffer()

  const buf7 = await sharp(inputPath)
    .rotate()
    .resize(W7, H7, { fit: "cover", position: "centre" })
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toBuffer()

  await fs.promises.writeFile(path.join(OUT_10, `${base}-${W10}x${H10}.png`), buf10)
  await fs.promises.writeFile(path.join(OUT_7, `${base}-${W7}x${H7}.png`), buf7)

  return { base, size10: buf10.length, size7: buf7.length }
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error("Quellordner fehlt:", SRC_DIR)
    process.exit(1)
  }
  for (const d of [OUT_10, OUT_7]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  }

  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort()

  if (files.length === 0) {
    console.error("Keine PNGs in", SRC_DIR)
    process.exit(1)
  }

  console.log(`${files.length} Datei(en) → ${path.relative(ROOT, OUT_10)}/ & ${path.relative(ROOT, OUT_7)}/\n`)
  for (const f of files) {
    const r = await processOne(f)
    const mb10 = (r.size10 / 1e6).toFixed(2)
    const mb7 = (r.size7 / 1e6).toFixed(2)
    console.log("OK", f, `→ 10": ${mb10} MB, 7": ${mb7} MB`)
  }
  console.log("\nFertig. In Play Console: Store-Eintrag → Tablet-Screenshots → 7-Zoll- bzw. 10-Zoll-Bereich.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

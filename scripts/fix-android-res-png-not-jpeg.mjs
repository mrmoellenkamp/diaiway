/**
 * Einige Generatoren speichern JPEG-Daten unter *.png — AAPT2 bricht dann mit
 * "file failed to compile" ab. Dieses Skript schreibt alle PNGs unter
 * android/app/src/main/res neu, wenn sie intern JPEG sind.
 *
 *   node scripts/fix-android-res-png-not-jpeg.mjs
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RES = path.join(__dirname, "..", "android", "app", "src", "main", "res")

function walkPngs(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walkPngs(p, acc)
    else if (ent.name.endsWith(".png")) acc.push(p)
  }
  return acc
}

async function main() {
  if (!fs.existsSync(RES)) {
    console.error("Missing", RES)
    process.exit(1)
  }
  const files = walkPngs(RES)
  let n = 0
  for (const fp of files) {
    const { info } = await sharp(fp).toBuffer({ resolveWithObject: true })
    if (info.format !== "jpeg") continue
    const tmp = fp + ".tmp"
    await sharp(fp).png({ compressionLevel: 9 }).toFile(tmp)
    await fs.promises.rename(tmp, fp)
    n++
    console.log("→ PNG", path.relative(path.join(__dirname, ".."), fp))
  }
  console.log(n ? `Fixed ${n} file(s).` : "No JPEG-as-PNG files found.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Erzeugt diAiway-Logos als reine Pfad-SVGs (ohne <text>, ohne externe Fonts).
 * Nutzt Arial / Arial Bold als Näherung an Geist.
 *
 * Ausführung (macOS, Arial in Supplemental): node scripts/generate-diaiway-logo-svg.cjs
 */
const fs = require("node:fs")
const path = require("node:path")
const opentype = require("opentype.js")

const root = path.join(__dirname, "..")
const publicDir = path.join(root, "public")

const FONT_CANDIDATES_REGULAR = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

const FONT_CANDIDATES_BOLD = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

const FONT_SIZE = 56
const BASELINE = 54
const LETTER_SPACING = -1.5
const VIEW_W = 340
const VIEW_H = 72

function resolveFont(candidates, label) {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  throw new Error(
    `Keine Schrift für ${label} gefunden. Erwartet z. B. Arial (macOS) oder Liberation Sans (Linux). Pfade: ${candidates.join(", ")}`
  )
}

function loadFont(p) {
  return opentype.loadSync(p)
}

function advanceWithSpacing(font, text, size) {
  let w = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const g = font.charToGlyph(ch)
    w += g.advanceWidth ? (g.advanceWidth / font.unitsPerEm) * size : 0
    if (i < text.length - 1) w += LETTER_SPACING
  }
  return w
}

function buildPaths(regular, bold) {
  const segments = [
    { font: regular, text: "di", fill: "#064e3b" },
    { font: bold, text: "Ai", fill: "#22c55e" },
    { font: regular, text: "way", fill: "#064e3b" },
  ]
  let x = 0
  const pathEls = []
  for (const seg of segments) {
    const p = seg.font.getPath(seg.text, x, BASELINE, FONT_SIZE)
    const d = p.toPathData(2)
    if (d) pathEls.push(`  <path fill="${seg.fill}" d="${d}"/>`)
    x += advanceWithSpacing(seg.font, seg.text, FONT_SIZE)
  }
  return pathEls.join("\n")
}

function wrapSvg(inner, { whiteBg }) {
  const bg = whiteBg ? `  <rect width="${VIEW_W}" height="${VIEW_H}" fill="#ffffff"/>\n` : ""
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${VIEW_W}" height="${VIEW_H}" role="img" aria-label="diAiway">\n` +
    bg +
    inner +
    "\n</svg>\n"
  )
}

function main() {
  const regular = loadFont(resolveFont(FONT_CANDIDATES_REGULAR, "Regular"))
  const bold = loadFont(resolveFont(FONT_CANDIDATES_BOLD, "Bold"))
  const paths = buildPaths(regular, bold)

  fs.writeFileSync(path.join(publicDir, "diaiway-logo-transparent.svg"), wrapSvg(paths, { whiteBg: false }), "utf8")
  fs.writeFileSync(path.join(publicDir, "diaiway-logo-white.svg"), wrapSvg(paths, { whiteBg: true }), "utf8")
  console.log("Written public/diaiway-logo-transparent.svg and public/diaiway-logo-white.svg")
}

main()

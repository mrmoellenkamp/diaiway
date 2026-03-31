#!/usr/bin/env node
/**
 * Ersetzt Standard-Tailwind-Paletten-Klassen (z. B. bg-amber-500/10) durch rgba-Arbitrary-Values.
 * Ergänzung zu apply-webview-safe-opacity.mjs (Theme-Tokens).
 *
 * node scripts/apply-palette-opacity.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const COLORS_JSON = path.join(__dirname, "tailwind-v34-colors.json")

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const raw = JSON.parse(fs.readFileSync(COLORS_JSON, "utf8"))
/** @type {Record<string, Record<string, [number,number,number]>>} */
const PALETTE = {}
for (const [family, shades] of Object.entries(raw)) {
  PALETTE[family] = {}
  for (const [shade, hex] of Object.entries(shades)) {
    PALETTE[family][shade] = hexToRgb(hex)
  }
}

function rgba(rgb, alpha) {
  const [r, g, b] = rgb
  const a = Math.round(alpha * 1000) / 1000
  return `rgba(${r},${g},${b},${a})`
}

const PALETTE_NAMES = Object.keys(PALETTE).sort((a, b) => b.length - a.length).join("|")

const PALETTE_RE = new RegExp(
  `(?<![\\w-])((?:[a-z0-9[\\]\\-]+:)*)(bg|text|border|ring|outline|fill|stroke|from|to|via|divide|marker|caret|placeholder|shadow)-(${PALETTE_NAMES})-(\\d+)\\/(\\d{1,3})(?![\\w-])`,
  "g",
)

function replacer(_m, variants, prop, family, shade, pctStr) {
  const fam = PALETTE[family]
  if (!fam) return _m
  const rgb = fam[shade]
  if (!rgb) return _m
  const a = parseInt(pctStr, 10) / 100
  const c = rgba(rgb, a)
  if (prop === "shadow") {
    return `${variants}shadow-[0_4px_14px_${c.replace(/\s/g, "")}]`
  }
  return `${variants}${prop}-[${c}]`
}

const EXT = new Set([".tsx", ".ts", ".css"])
const SKIP_DIR = new Set(["node_modules", ".next", "out", "dist", "android", "ios", ".git"])

function walk(dir, out) {
  if (SKIP_DIR.has(path.basename(dir))) return
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (EXT.has(path.extname(e.name))) out.push(p)
  }
}

const BW_RE =
  /(?<![\w-])((?:[a-z0-9[\]-]+:)*)(bg|text|border|ring|outline|fill|stroke|from|to|via|divide|marker|caret|placeholder|shadow)-(black|white)\/(\d{1,3})(?![\w-])/g

function bwReplacer(_m, variants, prop, name, pctStr) {
  const rgb = name === "black" ? [0, 0, 0] : [255, 255, 255]
  const a = parseInt(pctStr, 10) / 100
  const c = rgba(rgb, a)
  if (prop === "shadow") {
    return `${variants}shadow-[0_4px_14px_${c.replace(/\s/g, "")}]`
  }
  return `${variants}${prop}-[${c}]`
}

function transform(content) {
  return content.replace(PALETTE_RE, replacer).replace(BW_RE, bwReplacer)
}

function main() {
  const files = []
  for (const sub of ["app", "components", "lib", "styles"]) {
    const d = path.join(ROOT, sub)
    if (fs.existsSync(d)) walk(d, files)
  }
  let changed = 0
  for (const file of files) {
    const rawF = fs.readFileSync(file, "utf8")
    const next = transform(rawF)
    if (next !== rawF) {
      fs.writeFileSync(file, next, "utf8")
      changed++
      console.log("updated:", path.relative(ROOT, file))
    }
  }
  console.log(`Palette pass done. ${changed} files modified.`)
}

main()

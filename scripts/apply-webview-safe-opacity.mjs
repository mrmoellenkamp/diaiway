#!/usr/bin/env node
/**
 * Ersetzt Tailwind-Theme-Farben mit /opacity durch feste rgba()-Arbitrary-Values.
 * Grund: Ältere Android-WebViews (Chromium ~97–109) werten color-mix() für
 * bg-primary/5 u.ä. falsch aus → z.B. fast undurchsichtige helle Flächen.
 *
 * Ausführen: node scripts/apply-webview-safe-opacity.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const RGB = {
  primary: [6, 78, 59],
  "primary-foreground": [240, 253, 244],
  secondary: [245, 245, 244],
  "secondary-foreground": [28, 25, 23],
  muted: [245, 245, 244],
  "muted-foreground": [120, 113, 108],
  accent: [34, 197, 94],
  "accent-foreground": [5, 46, 22],
  destructive: [239, 68, 68],
  "destructive-foreground": [255, 255, 255],
  card: [255, 255, 255],
  "card-foreground": [28, 25, 23],
  popover: [255, 255, 255],
  "popover-foreground": [28, 25, 23],
  border: [231, 229, 227],
  background: [250, 250, 249],
  foreground: [28, 25, 23],
  ring: [6, 78, 59],
  input: [231, 229, 227],
  "chart-1": [6, 78, 59],
  "chart-2": [34, 197, 94],
  "chart-3": [245, 158, 11],
  "chart-4": [120, 113, 108],
  "chart-5": [168, 162, 158],
  amber: [245, 158, 11],
  "amber-foreground": [69, 26, 3],
  sidebar: [6, 78, 59],
  "sidebar-foreground": [240, 253, 244],
  "sidebar-primary": [34, 197, 94],
  "sidebar-primary-foreground": [5, 46, 22],
  "sidebar-accent": [6, 95, 70],
  "sidebar-accent-foreground": [240, 253, 244],
  "sidebar-border": [6, 95, 70],
  "sidebar-ring": [34, 197, 94],
}

/** Tailwind default palette (häufig im Projekt) */
const EMERALD = {
  50: [236, 253, 245],
  100: [209, 250, 229],
  200: [167, 243, 208],
  500: [16, 185, 129],
  600: [5, 150, 105],
  700: [4, 120, 87],
  800: [6, 95, 70],
  950: [2, 44, 34],
  400: [52, 211, 153],
}

const STONE = {
  200: [231, 229, 228],
}

function rgba(rgb, alpha) {
  const [r, g, b] = rgb
  const a = Math.round(alpha * 1000) / 1000
  return `rgba(${r},${g},${b},${a})`
}

/** Längste Token zuerst (primary-foreground vor primary) */
const SEMANTIC_KEYS = Object.keys(RGB).sort((a, b) => b.length - a.length)

const SEMANTIC_ALT = SEMANTIC_KEYS.join("|")

const SEMANTIC_RE = new RegExp(
  `(?<![\\w-])((?:[a-z0-9[\\]\\-]+:)*)(bg|text|border|ring|outline|fill|stroke|from|to|via|divide|marker|caret|placeholder|shadow)-(${SEMANTIC_ALT})\\/(\\d{1,3}|\\[[\\d.]+\\])(?![\\w-])`,
  "g",
)

function semanticReplacer(_m, variants, prop, colorKey, pctRaw) {
  const rgb = RGB[colorKey]
  if (!rgb) return _m
  let a
  if (pctRaw.startsWith("[")) {
    a = parseFloat(pctRaw.slice(1, -1))
    if (Number.isNaN(a)) return _m
  } else {
    a = parseInt(pctRaw, 10) / 100
  }

  if (prop === "shadow") {
    const c = rgba(rgb, a)
    return `${variants}shadow-[0_4px_14px_${c.replace(/\s/g, "")}]`
  }

  const c = rgba(rgb, a)
  return `${variants}${prop}-[${c}]`
}

const EMERALD_RE =
  /(?<![\w-])((?:[a-z0-9[\]-]+:)*)(bg|text|border|ring|outline|fill|stroke|from|to|via|divide|marker|caret|placeholder|shadow)-emerald-(\d+)\/(\d{1,3})(?![\w-])/g

function emeraldReplacer(_m, variants, prop, shade, pct) {
  const rgb = EMERALD[shade]
  if (!rgb) return _m
  const a = parseInt(pct, 10) / 100
  const c = rgba(rgb, a)
  if (prop === "shadow") {
    return `${variants}shadow-[0_4px_14px_${c.replace(/\s/g, "")}]`
  }
  return `${variants}${prop}-[${c}]`
}

const STONE_RE =
  /(?<![\w-])((?:[a-z0-9[\]-]+:)*)(bg|text|border|ring|outline)-stone-(\d+)\/(\d{1,3})(?![\w-])/g

function stoneReplacer(_m, variants, prop, shade, pct) {
  const rgb = STONE[shade]
  if (!rgb) return _m
  const a = parseInt(pct, 10) / 100
  return `${variants}${prop}-[${rgba(rgb, a)}]`
}

/** Häufige Standardfarben (opacity) */
const NAMED_REPLACEMENTS = [
  ["bg-white/80", "bg-[rgba(255,255,255,0.8)]"],
  ["bg-white/10", "bg-[rgba(255,255,255,0.1)]"],
  ["border-white/10", "border-[rgba(255,255,255,0.1)]"],
]

/** shadow-md + colored glow → eine Arbitrary-Klasse */
const SHADOW_COMBOS = [
  ["shadow-md shadow-primary/20", "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_6px_18px_rgba(6,78,59,0.22)]"],
  ["shadow-md shadow-primary/30", "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_8px_22px_rgba(6,78,59,0.28)]"],
  ["shadow-lg shadow-primary/10", "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_6px_16px_rgba(6,78,59,0.12)]"],
  ["shadow-lg shadow-primary/20", "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_8px_24px_rgba(6,78,59,0.22)]"],
  ["shadow-lg shadow-primary/30", "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_10px_28px_rgba(6,78,59,0.28)]"],
]

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

function transform(content) {
  let s = content
  for (const [a, b] of SHADOW_COMBOS) {
    s = s.split(a).join(b)
  }
  for (const [a, b] of NAMED_REPLACEMENTS) {
    s = s.split(a).join(b)
  }
  s = s.replace(SEMANTIC_RE, semanticReplacer)
  s = s.replace(EMERALD_RE, emeraldReplacer)
  s = s.replace(STONE_RE, stoneReplacer)
  return s
}

function main() {
  const files = []
  for (const sub of ["app", "components", "lib", "styles"]) {
    const d = path.join(ROOT, sub)
    if (fs.existsSync(d)) walk(d, files)
  }
  let changed = 0
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8")
    const next = transform(raw)
    if (next !== raw) {
      fs.writeFileSync(file, next, "utf8")
      changed++
      console.log("updated:", path.relative(ROOT, file))
    }
  }
  console.log(`Done. ${changed} files modified.`)
}

main()

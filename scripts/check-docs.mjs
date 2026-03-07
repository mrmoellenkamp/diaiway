#!/usr/bin/env node
/**
 * Documentation & i18n validation script.
 * Run: npm run docs:check
 *
 * Checks:
 * 1. i18n sync: All keys in de.ts exist in en.ts and es.ts (de = master)
 * 2. README exists and has key sections
 */

import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

function extractI18nKeys(filePath) {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, "utf-8")
  const keys = []
  const regex = /^\s*"([^"]+)":\s*["`{]/gm
  let m
  while ((m = regex.exec(content)) !== null) keys.push(m[1])
  return keys
}

function main() {
  let hasError = false

  // 1. i18n sync check
  const dePath = join(root, "lib/i18n/de.ts")
  const enPath = join(root, "lib/i18n/en.ts")
  const esPath = join(root, "lib/i18n/es.ts")

  const deKeys = extractI18nKeys(dePath)
  const enKeys = extractI18nKeys(enPath)
  const esKeys = extractI18nKeys(esPath)

  const enSet = new Set(enKeys)
  const esSet = new Set(esKeys)

  const missingInEn = deKeys.filter((k) => !enSet.has(k))
  const missingInEs = deKeys.filter((k) => !esSet.has(k))

  if (missingInEn.length > 0) {
    console.error("❌ i18n: Keys in de.ts missing in en.ts:")
    missingInEn.forEach((k) => console.error("   -", k))
    hasError = true
  }
  if (missingInEs.length > 0) {
    console.error("❌ i18n: Keys in de.ts missing in es.ts:")
    missingInEs.forEach((k) => console.error("   -", k))
    hasError = true
  }
  if (!hasError && deKeys.length > 0) {
    console.log("✅ i18n: de.ts, en.ts, es.ts in sync (" + deKeys.length + " keys)")
  }

  // 2. README check
  const readmePath = join(root, "README.md")
  if (!existsSync(readmePath)) {
    console.error("❌ README.md not found")
    hasError = true
  } else {
    const readme = readFileSync(readmePath, "utf-8")
    const required = ["## Features", "## Schnellstart", "## Umgebungsvariablen"]
    for (const section of required) {
      if (!readme.includes(section)) {
        console.error("❌ README.md missing section:", section)
        hasError = true
      }
    }
    if (!hasError) console.log("✅ README.md has required sections")
  }

  if (hasError) process.exit(1)
  console.log("\n✅ All documentation checks passed.")
}

main()

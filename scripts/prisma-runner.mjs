#!/usr/bin/env node
/**
 * Lädt .env und setzt DIRECT_URL := DATABASE_URL, falls DIRECT_URL fehlt
 * (schema.prisma verlangt beide; lokal ohne Pooler sind sie identisch).
 *
 * Usage (alles nach dem Script geht an prisma):
 *   node scripts/prisma-runner.mjs generate
 *   node scripts/prisma-runner.mjs migrate deploy
 *   node scripts/prisma-runner.mjs db push
 */
import { readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const root = process.cwd()
const envPath = resolve(root, ".env")

function loadDotenv() {
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadDotenv()

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL
}

const rest = process.argv.slice(2)
if (rest.length === 0) {
  console.error("Usage: node scripts/prisma-runner.mjs <prisma-args…>  z. B. generate | migrate deploy | db push")
  process.exit(1)
}

const prismaArgs = ["prisma", ...rest]

const result = spawnSync("npx", prismaArgs, {
  stdio: "inherit",
  env: process.env,
  cwd: root,
  shell: process.platform === "win32",
})

process.exit(result.status ?? 1)

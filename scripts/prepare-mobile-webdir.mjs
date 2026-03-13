#!/usr/bin/env node
/**
 * Creates a minimal ./out directory for Capacitor sync when using server.url.
 * The app loads from the deployed URL; this satisfies cap sync's webDir requirement.
 */
import { mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const outDir = join(root, "out")

const baseUrl =
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "https://www.diaiway.com"

mkdirSync(outDir, { recursive: true })

const indexHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${baseUrl}" />
  <title>diaiway</title>
  <script>window.location.replace("${baseUrl}");</script>
</head>
<body>
  <p>Weiterleitung zu diaiway…</p>
</body>
</html>
`

writeFileSync(join(outDir, "index.html"), indexHtml)
writeFileSync(join(outDir, "error.html"), "<!DOCTYPE html><html><body><p>Netzwerkfehler. Bitte prüfe deine Verbindung.</p></body></html>")

console.log("[prepare-mobile-webdir] Created minimal out/ for cap sync")

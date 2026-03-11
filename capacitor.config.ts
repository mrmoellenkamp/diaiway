import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor-Konfiguration für diAiway iOS/Android-App.
 * webDir: 'out' — Next.js Static Export (output: 'export') erzeugt den Build hier.
 * Hinweis: Für native Builds muss in next.config.mjs output: 'export' gesetzt werden.
 * Die Webapp nutzt weiterhin den Standard-Build ohne diese Option.
 */
const config: CapacitorConfig = {
  appId: "com.diaiway.app",
  appName: "diaiway",
  webDir: "out",
}

export default config

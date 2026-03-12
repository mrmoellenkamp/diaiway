import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor-Konfiguration für diAiway iOS/Android-App.
 * server.url: Lädt die Live-Webapp (www.diaiway.com) im WebView – sinnvoll, da das
 * Projekt API-Routes nutzt und kein Static Export möglich ist.
 * webDir: 'out' mit index.html – erforderlich für npx cap sync (Placeholder).
 */
const config: CapacitorConfig = {
  appId: "com.diaiway.app",
  appName: "diaiway",
  webDir: "out",
  server: {
    allowNavigation: ["diaiway.com", "www.diaiway.com", "*.diaiway.com", "*.vercel.app", "*.blob.vercel-storage.com"],
    errorPath: "error.html",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      showSpinner: false,
    },
  },
}

export default config

import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor-Konfiguration für diAiway iOS/Android-App.
 * server.url: Lädt die Live-Webapp im WebView (API-Routes erfordern Server).
 * webDir: 'out' – minimal durch scripts/prepare-mobile-webdir.mjs; cap sync kopiert es.
 */
const config: CapacitorConfig = {
  appId: "com.diaiway.app",
  appName: "diaiway",
  webDir: "out",
  server: {
    url: "https://www.diaiway.com",
    allowNavigation: ["diaiway.com", "www.diaiway.com", "*.diaiway.com", "*.vercel.app", "*.blob.vercel-storage.com"],
    errorPath: "error.html",
    iosScheme: "diaiway",
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

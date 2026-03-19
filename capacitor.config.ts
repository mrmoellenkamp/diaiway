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
    url: "https://diaiway.com",
    allowNavigation: [
      "diaiway.com",
      "www.diaiway.com",
      "*.diaiway.com",
      "*.vercel.app",
      "*.blob.vercel-storage.com",
      "*.public.blob.vercel-storage.com",
      "localhost",
      "127.0.0.1",
      "10.0.2.2",
    ],
    errorPath: "error.html",
    iosScheme: "diaiway",
    androidScheme: "https",
  },
  android: {},
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      showSpinner: false,
    },
    Camera: {
      // Für Snapshot-Moderation: Kamera-Zugriff
      permissions: ["camera"],
    },
  },
}

export default config

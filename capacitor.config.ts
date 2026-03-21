import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor-Konfiguration für diAiway iOS/Android-App.
 *
 * **Standard:** `server.url` = Produktion `https://diaiway.com` (WebView lädt die Live-App).
 *
 * **Schneller im Android-Emulator (lokal):** Vor `npx cap sync android` setzen:
 * `CAPACITOR_SERVER_URL=http://10.0.2.2:3000` (Next.js auf dem Host: `pnpm dev` an Port 3000).
 * Der Emulator erreicht den Host-Rechner nur über **10.0.2.2**, nicht über `localhost`.
 * Siehe `docs/MOBILE-READINESS.md` → „Emulator / Performance“.
 */
const allowNavigation = [
  "diaiway.com",
  "www.diaiway.com",
  "*.diaiway.com",
  "*.vercel.app",
  "*.blob.vercel-storage.com",
  "*.public.blob.vercel-storage.com",
  "localhost",
  "127.0.0.1",
  "10.0.2.2",
] as const

const capacitorDevServerUrl = process.env.CAPACITOR_SERVER_URL?.trim()
const useLocalDevServer = Boolean(capacitorDevServerUrl)
const isCleartextDev =
  useLocalDevServer && capacitorDevServerUrl!.startsWith("http:")

const server: CapacitorConfig["server"] = useLocalDevServer
  ? {
      url: capacitorDevServerUrl!,
      cleartext: isCleartextDev,
      allowNavigation: [...allowNavigation],
      errorPath: "error.html",
      iosScheme: "diaiway",
      androidScheme: isCleartextDev ? "http" : "https",
    }
  : {
      url: "https://diaiway.com",
      allowNavigation: [...allowNavigation],
      errorPath: "error.html",
      iosScheme: "diaiway",
      androidScheme: "https",
    }

const config: CapacitorConfig = {
  appId: "com.diaiway.app",
  appName: "diaiway",
  webDir: "out",
  server,
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

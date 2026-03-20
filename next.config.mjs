/**
 * =============================================================================
 * DSGVO – Verzeichnis der Verarbeitungstätigkeiten (Art. 30 DSGVO)
 * Technische Datenstandorte – Stand: März 2026
 * =============================================================================
 *
 * Verarbeitungsbereich   | Anbieter          | Standort / Region
 * -----------------------|-------------------|----------------------------------
 * Web-Hosting / CDN      | Vercel            | FRA1 (Frankfurt, DE) – primär
 * Datenbank (PostgreSQL) | Provider-abhaengig| EU-Region empfohlen (z. B. Frankfurt)
 * Blob-Speicher          | Vercel Blob       | FRA1 (Frankfurt, DE)
 * Zahlungsabwicklung     | Stripe            | EU-Instanz (Dublin/Frankfurt)
 * Video/Voice-Sessions   | Daily.co          | Mesh-Routing, EU-Egress bevorzugt
 * Safety-Bildanalyse     | Google Vision API | eu-vision.googleapis.com (EU-only)
 * E-Mail (SMTP)          | Konfigurierbar    | Abhängig von EMAIL_SERVER_HOST
 * Push (FCM/APNs)        | Google/Apple      | EU-Routing, kein explizites Locking
 *
 * Datenlöschung:
 * - Safety-Snapshots (nicht Incident-verknüpft): 48h (Cron cleanup-safety-data)
 * - Nutzerkonten: DSGVO-Anonymisierung (lib/anonymize-user.ts), kein Hard-Delete
 * - Wallet-Transaktionen: amountCents + type erhalten (§ 147 AO), PII → null
 *
 * Datenminimierung (Art. 5 Abs. 1 lit. c DSGVO):
 * - Live-Monitoring: Hard-Stop nach 120 s (5 Snapshots: 5s, 30s, 60s, 90s, 120s)
 *   → Kein kontinuierliches Überwachen; minimale Erfassung von Video-Frames
 * - PRE_CHECK: 0s-Snapshot vor Session-Start, kein Blob-Speicher bei Ablehnung
 * - Wallet-Aufladung: max. 100 € (keine Sammel-/Großbeträge gespeichert)
 *
 * Drittlandübermittlung (Art. 44–49 DSGVO):
 * - Google Vision: EU-Endpunkt erzwungen – keine Übermittlung in die USA
 * - Stripe: Standardvertragsklauseln (SCC), EU-Instanz
 * - Daily.co: DPA vorhanden; EU-TURN-Server konfiguriert
 * =============================================================================
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Android WebView can mis-resolve root-relative /_next paths.
  // Force absolute asset URLs to the live host for remote server.url mode.
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || "https://diaiway.com",
  ...(process.env.NEXT_PUBLIC_BASE_PATH && { basePath: process.env.NEXT_PUBLIC_BASE_PATH }),
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async redirects() {
    return [
      { source: "/dashboard/availability", destination: "/profile/availability", permanent: true },
      // Kanonische Produkt-URL: Apex (ohne www) — verhindert doppelte Hosts + Session-Cookie-Probleme (Safari/WebKit)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.diaiway.com" }],
        destination: "https://diaiway.com/:path*",
        permanent: true,
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 428, 768],
    imageSizes: [56, 64, 96, 128, 300],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
    ],
  },
}

export default nextConfig

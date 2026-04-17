# diAIway

**DIY-Hilfe auf Knopfdruck. Sicher. Schnell. Überall.**

diAIway verbindet Nutzer (Shugyo) mit Experten (Takumi) für Live-Beratung. Die Plattform bietet einen AI-Guide (diAIway intelligence), Buchungen, Sessions via Daily.co, Zahlungen mit **Stripe** (Hold & Capture, **Connect** für Marktplatz-Splits), internes **Guthaben (Wallet)** mit **GBL-Beleg** bei Aufladung, und mehrsprachige Unterstützung (DE, EN, ES).

**Hybrid App:** Die Web-App läuft auch als native iOS- und Android-App über **Capacitor 8**.

---

## Inhaltsverzeichnis

- [Features](#features)
- [Tech-Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Schnellstart](#schnellstart)
- [Mobile Build (Capacitor)](#mobile-build-capacitor)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Datenbank](#datenbank)
- [Rollen & Zugriff](#rollen--zugriff)
- [Dokumentation](#dokumentation)
- [Deployment](#deployment)

---

## Features

### Für Shugyo (Nutzer)
- **diAIway intelligence**: AI-Mentor für Projektbeschreibung und Expertenempfehlung
- **Kategorien durchsuchen**: 11 Kategorien (Heimwerken, Freizeit & Hobby, Haus & Garten, etc.)
- **Buchungen**: Termine mit Takumis buchen; **Video oder Voice**; max. 7 Tage im Voraus; Vorauszahlung (Stripe oder Wallet)
- **Instant Connect**: Spontaner Anruf bei verfügbaren Takumis (ohne Terminbuchung); 60s Expiry bei keiner Antwort (Cron: `/api/cron/instant-request-cleanup`)
- **Sessions (Scheduled)**: Daily.co Video/Voice; 5 Min Handshake gratis, danach Capture (Stripe oder Wallet)
- **Handshake-Logik**: \< 5 Min → automatische Rückerstattung / Hold-Freigabe; ≥ 5 Min → Capture
- **Instant-Call-Abrechnung**: Wallet post-session; **Erstkontakt: 5 Min gratis**, **Zweitkontakt: 30 Sek gratis** (`hasPaidBefore`-Logik)
- **Wallet (Guthaben)**: Aufladen per Stripe (PDF-**Guthabenbeleg GBL**, keine Umsatzsteuer-Rechnung); Zahlung bei Buchung mit Balance-Guard; atomare Abzüge
- **Benachrichtigungen**: Buchungsbestätigungen; **löschbar mit Bestätigungsdialog**
- **Nachrichten (Postfach)**: **Chat** (Direktnachrichten) und **Waymails** (E-Mail-ähnlich mit Betreff); **Posteingang** und **Postausgang**; Waymails/Chats/Nachrichten **löschbar mit Bestätigungsdialog**; Anhänge (Bilder, PDF) via Secure Upload; Waymail-Deep-Links (`/messages?waymail={id}`) mit callbackUrl nach Login; **serverseitig keine externen Links/Kontaktdaten** in Chat, Waymail-Betreifen und relevanten Freitextfeldern (`lib/contact-leak-validation.ts`)
- **Profil**: **Username** als Profilname (optional, eindeutig); Favoriten, Sessions; **Konto pausieren** (sofort offline als Takumi); **Konto löschen** (DSGVO-Anonymisierung)
- **Session-Aktivität**: 15 Min Inaktivitäts-Time-out; Warnung 60 Sek vor Ablauf; Heartbeat verlängert Session; automatischer Logout
- **Safety**: Snapshot-Einwilligung, Live-Monitoring; bei Voice entfällt Pre-Check
- **Push-Benachrichtigungen**: Web Push (VAPID) + Capacitor (FCM/APNs)

### Für Takumi (Experten)
- **Profil & Verfügbarkeit**: 15-Min-Intervall-Kalender; Preis Video/Voice pro 15 Min
- **Profil-Moderation**: Entwurf speichern vs. Einreichen zur Prüfung; erst nach Admin-Freigabe (`profileReviewStatus: approved`) öffentlich in Takumi-Listen; bei signifikanten Bio-Änderungen erneute Prüfung; öffentliche Bio kann während Re-Review `bioLive` bleiben; Admin: `/admin/takumi-profile-reviews`, Widerruf mit Textbausteinen: `/admin/takumi-profile-revocations`
- **Gast-Calls (externe Kunden)**: Tab **„Gast einladen“** unter `/profile/availability` – Gast-E-Mail, Slot, optional Preis; API `POST /api/expert/guest-bookings`; öffentlicher Link `/call/[guestToken]` (Rechnungsdaten, Einwilligungen, Stripe-Sofortzahlung, optional Konto mit Passwort; Daily.co nach Zahlung)
- **Stornierungsrichtlinie**: Kostenlose Stornierung bis X Stunden, danach Gebühr
- **Buchungsanfragen**: E-Mail + In-App + Push; Annehmen/Ablehnen/Rückfrage
- **Live-Status**: `offline` | `available` | `in_call` | `busy` für Instant Connect; **„Verfügbar“ nur bei freigegebenem Profil**
- **Instant Connect**: Anklopfen durch Shugyo; Takumi antwortet live

### Für Admins
- **Admin-Layout** (`app/(app)/admin/layout.tsx`): Dedizierter Guard – NextAuth + Prisma-Rolle; **kein Sidebar**, Tab-Navigation
- **Admin-Dashboard** (`/admin`): **9 Tabs** – Übersicht, **Statistik** (Website-Traffic), Nutzer, Buchungen, Takumis, Finanzen, Sicherheit, Scanner, System; mobile-optimiert (`flex-wrap`); Direktlink-Banner „Website-Statistik“; Deep-Link **`/admin?tab=analytics`**
- **Statistik-Tab**: Besuche, Unique Visitor, Verweildauer (aktive Zeit), Bounce, Top-Pfade; Daten aus `SiteAnalyticsSession` / `SiteAnalyticsPageView` (Migration erforderlich); öffentlicher Beacon `POST /api/analytics/beacon` (kein Tracking von `/admin`)
- **Vision-Scanner** (Tab): Google Cloud Vision – Labels, Objekte, OCR, Safe Search, Farben, Gesichter, Web; Bild-Upload oder Kamera; Ergebnisse direkt unter dem Analyse-Button
- **Sicherheit-Tab**: Safety Reports, KI-Incidents; Links zu `/admin/safety` und `/admin/safety/incidents`
- **System-Tab**: Links zu **Taxonomie** (`/admin/taxonomy`), **Startseiten-News** (`/admin/home-news`), **Rechnungs-PDF** (`/admin/invoice-branding`), Health-Check, Waymail-Templates, DB-Tools
- **Eigene Seiten** (zusätzlich zum Dashboard): `/admin/health-check`, `/admin/finance`, `/admin/invoice-branding` (PDF-Branding, Vorschau, Test-E-Mail), `/admin/templates`, `/admin/taxonomy`, `/admin/home-news`, `/admin/safety`, `/admin/safety/incidents`, `/admin/takumi-profile-reviews`, `/admin/takumi-profile-revocations`, `/admin/guest-bookings` (Gast-Call-Einladungen: Liste, Stornieren, Löschen, Link kopieren); `/admin/scanner` → Redirect ins Dashboard (Scanner-Tab)
- **Health-Check** (`/admin/health-check`): Live-Monitoring – Cron-Laufzeiten, Stripe-Escrow-Risiken (6+ Tage), Wallet-Integrität, Push-Reachability; Force-Capture pro Buchung
- **Finance Monitoring** (`/admin/finance`): Escrow-Holds, Stripe-Expiry (7 Tage), Shugyo-Wallet-Liability; Force Capture, Manual Release mit Doppelbestätigung
- **Transaction Audit Log**: Stripe, Wallet, Admin-Aktionen; alle Finanz-Ops in `prisma.$transaction`
- **CSV-Export**: Financial CSV (DATEV-ready), ZIP (PDFs), DATEV-CSV
- **Safety Incidents**: Alert-Bilder unter `/admin/safety/incidents`
- **AdminActionLog**: Alle Admin-Aktionen (force_capture, manual_release, refund)
- **Taxonomie-Admin**: Kategorien & Fachbereiche, Icons (Lucide oder Upload), Takumi-Zuordnung, Backfill von Legacy-Feldern
- **Startseiten-News**: Mehrsprachige Meldungen (DE/EN/ES), optional Links pro Sprache + Fallback-Link (`HomeNewsItem` / `HomeNewsTranslation`)

### Technisch
- **Öffentliche Gast-Route**: `/call/[guestToken]` ohne Login (Middleware-Ausnahme); Rechtstexte und Formular in DE/EN/ES (`guestCall.*`, `guestInvite.*`)
- **Gast-Safety**: Blitzlicht-Snapshots über `POST /api/guest/snapshot` (Auth via `guestToken`); gleiche Vision-Policy wie eingeloggte Nutzer; bei Verstoß Incident + Experten-Flag
- **i18n**: Deutsch (Master), Englisch, Spanisch; Sprachenauswahl im Header (Länderkürzel: DE, EN, ES)
- **Beta-Landing**: `/beta` → Redirect `/beta/de`; statische Seiten `/beta/de`, `/beta/en`, `/beta/es` (Founder-Karte, CTA, Hero-Visuals)
- **Vercel Analytics**: `@vercel/analytics` im Root-Layout (anbieterseitige Metriken); **eigene** Statistik zusätzlich in Admin-Tab (siehe oben)
- **Zahlung**: Stripe Hold & Capture (manual capture) wo vorgesehen; **Stripe Connect** für Buchungszahlungen an Takumi; Wallet mit atomarem Abzug + Balance-Guard; 7-Tage-Stripe-Hold-Fenster; **Belege** (RE/GS/PR/SR/SG/GBL): siehe [docs/BILLING-DOCUMENTS-AND-PAYMENTS.md](docs/BILLING-DOCUMENTS-AND-PAYMENTS.md)
- **Push**: Web Push (VAPID) + Firebase Admin (FCM) für native; **Kategorien** (`pushType`) für Android-Kanäle / iOS-Categories; Quick Actions (ACCEPT/DECLINE) bei Instant Connect
- **Safety**: Google Vision API (Pre-Check + Live-Monitoring); bei Verstoß **sofortige Verbindungstrennung**; Cloudmersive (Virenscan bei Upload); manueller Report-Button im Call
- **E2EE**: Video-Calls end-to-end verschlüsselt (P2P-Modus via `sfu_switchover: 2`); Medien fließen direkt zwischen Geräten, Daily.co sieht keine Klartext-Streams
- **Sicherheit**: API-weit Rate-Limits pro User **und** IP (Upstash mit In-Memory-Fallback), Honeypot, bcrypt, CSP mit `'self'`, `'unsafe-inline'` und expliziten Skript-Hosts (kein `unsafe-eval`; kein Script-Nonce und kein `strict-dynamic`, damit Next.js 16 Inline- und Chunk-Skripte in allen Browsern lädt), Zod-Schemas für alle Mutations-Routen, timing-safe Secret-Vergleiche, serverseitige Preisberechnung, HMAC-signierte Proxy-URLs für sensible Blobs, Magic-Byte-Prüfung bei Bild-Uploads, Log-Redaktion für Secrets; **Cache-Control: no-store** für geschützte Seiten (kein BFCache); **LogoutBackGuard** verhindert Zurück-Button-Cache nach Logout. Details: [SECURITY.md](SECURITY.md)
- **Auth-Resilienz**: DB-Verbindungsfehler (P1001) → `DB_ERROR` statt „falsches Passwort“; JWT-DB-Sync alle 5 Min (throttled)
- **Secure File Upload**: `/api/files/secure-upload` mit Cloudmersive-Virenscan, Busboy-Streaming (max 2,5 MB)
- **Session-Terminierung**: `/api/sessions/[id]/terminate` für 5-Min-Handshake (Case A) oder Capture (Case B)
- **Messages API**: GET (Waymails, Chat-Threads), POST (senden), PATCH (als gelesen), **DELETE** (Waymail, Einzelnachricht, ganzer Thread)

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Datenbank | PostgreSQL (Prisma ORM, provider-unabhaengig) |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| Zahlung | Stripe (Embedded Checkout, Hold & Capture, Webhooks, **Connect** für Splits) |
| Video/Voice | Daily.co (`@daily-co/daily-js`), E2EE (P2P) |
| Mobile | Capacitor 8 (iOS, Android) |
| AI | Vercel AI SDK (Gemini) |
| Storage | Vercel Blob |
| E-Mail | Nodemailer (SMTP) |
| Push | web-push (VAPID), Firebase Admin (FCM), @capacitor/push-notifications |
| Safety | Google Cloud Vision API (SafeSearch), Cloudmersive (Virenscan) |
| UI | Tailwind CSS, Radix UI, Shadcn |
| i18n | Custom (de.ts, en.ts, es.ts) |

**Dependencies (major):** Daily.co, Stripe, Firebase Admin, Cloudmersive, Google Vision, VAPID (web-push), Sharp (image), jspdf/pdf-lib (invoices).

---

## Projektstruktur

```
├── app/
│   ├── (app)/              # Geschützte App-Routen
│   │   ├── admin/          # Admin: Dashboard + taxonomy, home-news, finance, health-check, safety, takumi-profile-reviews, takumi-profile-revocations, guest-bookings, …
│   │   ├── ai-guide/
│   │   ├── booking/[id]/
│   │   ├── session/[id]/   # Session-Seite (Daily.co)
│   │   ├── sessions/
│   │   └── ...
│   ├── call/[guestToken]/  # Öffentlich: Gast-Call (Legal-Gate, Stripe, Daily)
│   ├── api/
│   │   ├── admin/finance/  # Summary, Force-Capture, Manual-Release, Audit-Log, Export
│   │   ├── bookings/       # POST, instant, instant-check, pay-with-wallet
│   │   ├── guest/          # checkout, meeting, snapshot, auto-login, signin
│   │   ├── expert/guest-bookings/  # Takumi: Gast-Buchungen anlegen + listen
│   │   ├── sessions/[id]/terminate/
│   │   ├── daily/meeting/
│   │   ├── expert/         # heartbeat, live-status, instant-requests
│   │   ├── files/secure-upload/
│   │   ├── push/subscribe/
│   │   └── ...
│   └── ...
├── components/             # Deep-Link-Handler, Push-Provider, Native-Test-Center, admin/vision-scanner-tab
├── hooks/                  # use-native-bridge (Camera, Push, Preferences)
├── lib/                    # Auth, DB, push, wallet-service, booking-date-validation
├── ios/                    # Capacitor iOS-Projekt
├── android/                # Capacitor Android-Projekt
├── capacitor.config.ts
└── prisma/
```

---

## Schnellstart

### Voraussetzungen
- Node.js 18+
- PostgreSQL (provider-unabhaengig, z. B. Prisma Postgres, Supabase, Railway oder lokal)
- Stripe-, Vercel-Blob-Accounts (optional für lokale Entwicklung)

### Installation

```bash
git clone https://github.com/YOUR_ORG/diaiway.git
cd diaiway

npm install
cp .env.example .env
# .env mit echten Werten füllen

npx prisma generate
npx prisma db push   # oder: npx prisma migrate deploy

npm run dev
```

App: [http://localhost:3001](http://localhost:3001) (Port laut `package.json` → `next dev -p 3001`)

### Qualität (Lint & Typen)

```bash
npm run lint        # ESLint (Next.js Core Web Vitals + TypeScript)
npm run lint:fix    # automatische Fixes wo möglich
npm run typecheck   # TypeScript ohne Build
npm run check       # lint + typecheck (empfohlen vor Commit/CI)
```

**GitHub Actions:**
- `.github/workflows/ci.yml` — bei Push/PR auf `main`/`master`: `npm run check` (Lint + Typecheck)
- `.github/workflows/docs-check.yml` — bei Änderungen an `docs/**`, `README.md`, `lib/i18n/**`: `npm run docs:check`

Details: [docs/GITHUB.md](docs/GITHUB.md)

---

## Mobile Build (Capacitor)

Die App ist eine **Hybrid-App** mit Capacitor. Native Features:

- **@capacitor/camera**: Foto-Capture
- **@capacitor/push-notifications**: FCM/APNs-Token für Push
- **@capacitor/local-notifications**: Lokale Benachrichtigungen
- **@capacitor/haptics**: Haptisches Feedback
- **@capacitor/network**: Netzwerkstatus
- **@capacitor/preferences**: Key-Value-Speicher
- **@capacitor/share**: System-Share-Dialog
- **@capacitor/splash-screen**: Splash-Screen-Steuerung

### iOS / Android bauen

```bash
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios
# oder: npx cap open android
```

### Deep-Linking
- **iOS/Android**: `App.getLaunchUrl()` wird in `deep-link-handler.tsx` ausgewertet
- **Web**: `callbackUrl` nach Login für Waymail-Links (`/messages?waymail={id}`)

---

## Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `DATABASE_URL` | PostgreSQL-Verbindungsstring |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | NextAuth |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `FILE_SIGNING_SECRET` | Optional; HMAC-Key für signierte Blob-Proxy-URLs (Fallback: `NEXTAUTH_SECRET`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate-Limits + Gast-Checkout-Store (Fallback: In-Memory pro Instanz) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push (optional) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM für native Push (optional) |
| `EMAIL_*` | SMTP (EMAIL_SERVER_HOST, PORT, USER, PASSWORD, EMAIL_FROM) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (diAIway intelligence) |
| `GOOGLE_CLOUD_VISION_API_KEY` | Vision API (Safety, Live-Monitoring) |
| `CLOUDMERSIVE_API_KEY` | Virenscan bei Secure-Upload (optional) |
| `DAILY_API_KEY` | Daily.co (Video-Sessions) |
| `CRON_SECRET`, `DAILY_GHOST_SECRET` | Cron-Routes (timing-safe verglichen) |

Details: [docs/ENV.md](docs/ENV.md)

---

## Datenbank

### Wichtige Modelle
- **User**: `name`, `username` (optional, eindeutig; wird als Profilname verwendet); balance, pendingBalance (Wallet); appRole (shugyo/takumi); Anonymisierte: `user_deleted_xxx@anonymized.local`
- **Expert**: liveStatus (`offline` \| `available` \| `in_call` \| `busy`); priceVideo15Min, priceVoice15Min; **Profil-Moderation**: u. a. `profileReviewStatus`, `bioLive`, `bioPendingReview`, `profileRejectionReason`; `TakumiProfileRevokeSnippet` für Widerrufs-Textbausteine
- **Booking**: status (incl. `cancelled_in_handshake`, `instant_expired`); bookingMode (scheduled \| instant); **Gast-Calls**: `isGuestCall`, `guestEmail`, `guestToken` (unique); **`userId` optional** (null bis Gast ggf. nach Zahlung ein Konto anlegt)
- **Transaction**: status (AUTHORIZED, CAPTURED, CANCELED, REFUNDED)
- **WalletTransaction**: amountCents (positiv = Credit, negativ = Debit); type (topup, booking_payment, refund)
- **PushSubscription**: endpoint, p256dh, auth für Web Push
- **CronRunLog**: cronName, lastRunAt (Health-Check; release-wallet, experts-offline, instant-request-cleanup, cleanup-safety-data, session-reminders, …)
- **AdminActionLog**: Admin-Aktionen (force_capture, manual_release, refund)
- **HomeNewsItem** / **HomeNewsTranslation**: Startseiten-Newsfeed (mehrsprachig, optionale Links pro Locale)
- **TaxonomyCategory** / **TaxonomySpecialty** / Junctions: Kategorien-System für Takumis (siehe `docs/ARCHITECTURE.md`)
- **SiteAnalyticsSession** / **SiteAnalyticsPageView**: anonyme Website-Statistik (optional; Migration `site_analytics`)

```bash
npx prisma generate
npx prisma db push
npx prisma studio
```

---

## Geschäftsregeln (kurz)

| Regel | Implementierung |
|-------|-----------------|
| Buchungsfenster | Max. 7 Tage im Voraus (`lib/booking-date-validation.ts`) |
| Stripe Hold | 7 Tage (nicht 24h); `STRIPE_HOLD_DAYS` in Finance-Summary |
| 5-Min Handshake | \< 5 Min Dauer → Release (Case A); ≥ 5 Min → Capture (Case B) |
| Wallet | Atomar: `updateMany` mit `balance >= amount` + `decrement`; Balance-Guard |
| Instant Cleanup | 60s ohne Takumi-Antwort → Status `instant_expired`, Payment-Release, Push/Waymail |
| Instant-Abrechnung | Erstkontakt: 5 Min gratis; Zweitkontakt: 30 Sek gratis; Wallet post-session (`chargeInstantCallToWallet`) |
| Wallet-Release-Cron | 24h nach Session-Ende: `processPendingCompletions` |

---

## Rollen & Zugriff

| Rolle | Beschreibung |
|-------|--------------|
| **shugyo** | Nutzer: Kategorien, Buchungen, Sessions, Profil |
| **takumi** | Experte: + Verfügbarkeit, Takumi-Profil, Instant Connect |
| **admin** | + Admin-Dashboard, Health-Check, Finance Monitoring, Safety; Admin-Konten sind vor Löschung geschützt |

- `/profile/availability`: nur Takumi & Admin (Kalender)
- `/admin`: nur Admin; **Layout-Guard** (`app/(app)/admin/layout.tsx`) prüft NextAuth + Prisma-Rolle serverseitig
- Pausierte Konten: Redirect zu `/paused`; Takumi wird sofort `liveStatus: offline`

---

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| [docs/INDEX.md](docs/INDEX.md) | **Dokumentations-Index** – alle Docs auf einen Blick |
| [SECURITY.md](SECURITY.md) | **Security-Policy:** Responsible Disclosure, Bedrohungsmodell, Rate-Limits je Route, CSP, signierte Blob-URLs, Secret-Rotation |
| [docs/GITHUB.md](docs/GITHUB.md) | **GitHub**: Workflows, Secrets vs. Repo, PR-Checkliste, was nicht committen |
| [README.md](README.md) | Übersicht, Setup, Features |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architektur, Datenflüsse, API-Übersicht |
| [docs/HIDDEN-MECHANICS.md](docs/HIDDEN-MECHANICS.md) | Verborgene Mechaniken: Idempotenz, Revocation, Optimistic UI, RBAC, Admin-Stats „degraded“ (HTTP 200), Site-Analytics-Beacon, Capacitor-`out/`, Session Activity, LogoutBackGuard, … |
| [docs/ADMIN.md](docs/ADMIN.md) | Admin-Layout, Health-Check, DSGVO-Kontoverwaltung, Pause-Logik, Rechnungs-PDF |
| [docs/BILLING-DOCUMENTS-AND-PAYMENTS.md](docs/BILLING-DOCUMENTS-AND-PAYMENTS.md) | **Belege & Zahlungen:** RE/GS/PR/SR/SG/GBL, Nummernkreise, Gutschriftverfahren, MwSt-Takumi, Webhooks, iOS-Hinweise |
| [docs/ENV.md](docs/ENV.md) | Umgebungsvariablen |
| [docs/DEPLOYMENT-AUTH.md](docs/DEPLOYMENT-AUTH.md) | **Production-Login:** `NEXTAUTH_URL`, www→apex, Safari/WebKit |
| [docs/MOBILE-READINESS.md](docs/MOBILE-READINESS.md) | Mobile-Richtlinien (Capacitor integriert) |
| [docs/MOBILE-BUILD.md](docs/MOBILE-BUILD.md) | Mobile Build (Capacitor) |
| [docs/DEEP-LINKING-SETUP.md](docs/DEEP-LINKING-SETUP.md) | Deep-Links (Waymail, Chat) |
| [docs/SECURE-FILE-EXCHANGE.md](docs/SECURE-FILE-EXCHANGE.md) | Sichere Datei-Übertragung |
| [docs/STORE-COMPLIANCE-CHECKLIST.md](docs/STORE-COMPLIANCE-CHECKLIST.md) | App-Store-Compliance (gemeinsame Basis) |
| [docs/GOOGLE-PLAY-COMPLIANCE.md](docs/GOOGLE-PLAY-COMPLIANCE.md) | Google Play: Console, Data safety, Checklisten |
| [docs/IOS-APP-STORE-COMPLIANCE.md](docs/IOS-APP-STORE-COMPLIANCE.md) | iOS App Store Compliance |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | i18n, Code-Stil, Verweis auf GitHub/CI |
| [docs/UPDATE.md](docs/UPDATE.md) | Matrix: welche Doku bei welcher Änderung anfassen |

---

## Deployment

### Vercel (Git)

1. Projekt mit GitHub verbinden
2. Umgebungsvariablen setzen (inkl. `DATABASE_URL` / `DIRECT_URL`, `CRON_SECRET` für Cron-Routes)
3. Build: Standard ist `npm run build` – dabei laufen **`prisma migrate deploy`** (offene Migrationen auf die DB) **und** `prisma generate` vor `next build`. Vercel muss dafür **Production** (und ggf. Preview) mit derselben DB-URL versorgen.
4. Stripe Webhook: `checkout.session.completed`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`; für **Gast-Calls** setzt die Checkout-Session in den Metadaten u. a. `type: guest_call_payment` und `bookingId` (siehe `app/api/webhooks/stripe/route.ts`)
5. Cron-Jobs: `vercel.json` – `release-wallet`, `experts-offline`, `instant-request-cleanup`, `cleanup-safety-data`, `session-reminders`; alle benötigen `Authorization: Bearer <CRON_SECRET>` (außer ggf. Hobby-Plan-Limits beachten)

### Vercel CLI (ohne Git)

```bash
vercel --prod
```

- Lädt lokale Änderungen direkt hoch
- `vercel.json` enthält Cron-Schedules; **Hobby-Plan**: Crons max. 1× täglich pro Route
- `instant-request-cleanup`: `0 8 * * *` (8:00) – für Instant Connect mit 60s-Expiry: externer Cron oder Pro-Plan

### Nach dem ersten Deploy

- Migrationen: laufen automatisch beim Build, sobald `DATABASE_URL` in Vercel gesetzt ist. Optional einmal lokal: `npm run db:migrate:deploy` mit Production-URL.
- **Home-News Beta seed** (optional): einmalig mit Production-`DATABASE_URL`: `npm run seed:home-news-beta`
- E-Mail-SMTP konfigurieren

---

## Lizenz

Proprietär. Alle Rechte vorbehalten.

---

*Letzte Aktualisierung: April 2026 – Security-Hardening (Rate-Limits, CSP-Nonce, signierte Blob-URLs, Upstash-Guest-Store); siehe [SECURITY.md](SECURITY.md)*

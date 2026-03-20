# diAIway

**DIY-Hilfe auf Knopfdruck. Sicher. Schnell. Überall.**

diAIway verbindet Nutzer (Shugyo) mit Experten (Takumi) für Live-Beratung. Die Plattform bietet einen AI-Guide (diAIway intelligence), Buchungen, Sessions via Daily.co, Escrow-Zahlungen mit Stripe (Hold & Capture), internes Wallet, und mehrsprachige Unterstützung (DE, EN, ES).

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
- **Wallet**: Guthaben aufladen (Stripe), mit Wallet bei Buchung zahlen; atomare Abzüge mit Balance-Guard
- **Benachrichtigungen**: Buchungsbestätigungen; **löschbar mit Bestätigungsdialog**
- **Nachrichten (Postfach)**: **Chat** (Direktnachrichten) und **Waymails** (E-Mail-ähnlich mit Betreff); **Posteingang** und **Postausgang**; Waymails/Chats/Nachrichten **löschbar mit Bestätigungsdialog**; Anhänge (Bilder, PDF) via Secure Upload; Waymail-Deep-Links (`/messages?waymail={id}`) mit callbackUrl nach Login
- **Profil**: **Username** als Profilname (optional, eindeutig); Favoriten, Sessions; **Konto pausieren** (sofort offline als Takumi); **Konto löschen** (DSGVO-Anonymisierung)
- **Session-Aktivität**: 15 Min Inaktivitäts-Time-out; Warnung 60 Sek vor Ablauf; Heartbeat verlängert Session; automatischer Logout
- **Safety**: Snapshot-Einwilligung, Live-Monitoring; bei Voice entfällt Pre-Check
- **Push-Benachrichtigungen**: Web Push (VAPID) + Capacitor (FCM/APNs)

### Für Takumi (Experten)
- **Profil & Verfügbarkeit**: 15-Min-Intervall-Kalender; Preis Video/Voice pro 15 Min
- **Stornierungsrichtlinie**: Kostenlose Stornierung bis X Stunden, danach Gebühr
- **Buchungsanfragen**: E-Mail + In-App + Push; Annehmen/Ablehnen/Rückfrage
- **Live-Status**: `offline` | `available` | `in_call` | `busy` für Instant Connect
- **Instant Connect**: Anklopfen durch Shugyo; Takumi antwortet live

### Für Admins
- **Admin-Layout** (`app/(app)/admin/layout.tsx`): Dedizierter Guard – NextAuth + Prisma-Rolle; **kein Sidebar**, Tab-Navigation
- **Admin-Dashboard** (`/admin`): **8 Tabs** – Übersicht, Nutzer, Buchungen, Takumis, Finanzen, Sicherheit, Scanner, System; mobile-optimiert (Tabs umbrechen)
- **Vision-Scanner** (Tab): Google Cloud Vision – Labels, Objekte, OCR, Safe Search, Farben, Gesichter, Web; Bild-Upload oder Kamera; Ergebnisse direkt unter dem Analyse-Button
- **Sicherheit-Tab**: Safety Reports, KI-Incidents; Links zu `/admin/safety` und `/admin/safety/incidents`
- **System-Tab**: Health-Check, Waymail-Templates, DB-Tools
- **Health-Check** (`/admin/health-check`): Live-Monitoring – Cron-Laufzeiten, Stripe-Escrow-Risiken (6+ Tage), Wallet-Integrität, Push-Reachability; Force-Capture pro Buchung
- **Finance Monitoring** (`/admin/finance`): Escrow-Holds, Stripe-Expiry (7 Tage), Shugyo-Wallet-Liability; Force Capture, Manual Release mit Doppelbestätigung
- **Transaction Audit Log**: Stripe, Wallet, Admin-Aktionen; alle Finanz-Ops in `prisma.$transaction`
- **CSV-Export**: Financial CSV (DATEV-ready), ZIP (PDFs), DATEV-CSV
- **Safety Incidents**: Alert-Bilder unter `/admin/safety/incidents`
- **AdminActionLog**: Alle Admin-Aktionen (force_capture, manual_release, refund)

### Technisch
- **i18n**: Deutsch (Master), Englisch, Spanisch; Sprachenauswahl im Header (Länderkürzel: DE, EN, ES)
- **Zahlung**: Stripe Hold & Capture (manual capture); Wallet mit atomarem `updateMany` + Balance-Guard; 7-Tage-Stripe-Hold-Fenster
- **Push**: Web Push (VAPID) + Firebase Admin (FCM) für native; Quick Actions (ACCEPT/DECLINE) bei Instant Connect
- **Safety**: Google Vision API (Pre-Check + Live-Monitoring); bei Verstoß **sofortige Verbindungstrennung**; Cloudmersive (Virenscan bei Upload); manueller Report-Button im Call
- **E2EE**: Video-Calls end-to-end verschlüsselt (P2P-Modus via `sfu_switchover: 2`); Medien fließen direkt zwischen Geräten, Daily.co sieht keine Klartext-Streams
- **Sicherheit**: Rate-Limiting, Honeypot, bcrypt, Security-Headers; **Cache-Control: no-store** für geschützte Seiten (kein BFCache); **LogoutBackGuard** verhindert Zurück-Button-Cache nach Logout
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
| Zahlung | Stripe (Embedded Checkout, Hold & Capture, Webhooks) |
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
│   │   ├── admin/          # Admin (layout.tsx Guard), Dashboard mit 8 Tabs, Health-Check, Finance, Safety, Templates, Scanner (redirect)
│   │   ├── ai-guide/
│   │   ├── booking/[id]/
│   │   ├── session/[id]/   # Session-Seite (Daily.co)
│   │   ├── sessions/
│   │   └── ...
│   ├── api/
│   │   ├── admin/finance/  # Summary, Force-Capture, Manual-Release, Audit-Log, Export
│   │   ├── bookings/       # POST, instant, instant-check, pay-with-wallet
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

App: [http://localhost:3000](http://localhost:3000)

### Qualität (Lint & Typen)

```bash
npm run lint        # ESLint (Next.js Core Web Vitals + TypeScript)
npm run lint:fix    # automatische Fixes wo möglich
npm run typecheck   # TypeScript ohne Build
npm run check       # lint + typecheck (empfohlen vor Commit/CI)
```

**GitHub Actions:** `.github/workflows/ci.yml` führt bei Push/PR auf `main`/`master` ebenfalls `npm run check` aus (parallel zu `docs-check.yml` für Doku/i18n).

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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push (optional) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM für native Push (optional) |
| `EMAIL_*` | SMTP (EMAIL_SERVER_HOST, PORT, USER, PASSWORD, EMAIL_FROM) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (diAIway intelligence) |
| `GOOGLE_CLOUD_VISION_API_KEY` | Vision API (Safety, Live-Monitoring) |
| `CLOUDMERSIVE_API_KEY` | Virenscan bei Secure-Upload (optional) |
| `DAILY_API_KEY` | Daily.co (Video-Sessions) |
| `CRON_SECRET` | Cron-Routes (instant-request-cleanup, release-wallet, etc.) |

Details: [docs/ENV.md](docs/ENV.md)

---

## Datenbank

### Wichtige Modelle
- **User**: `name`, `username` (optional, eindeutig; wird als Profilname verwendet); balance, pendingBalance (Wallet); appRole (shugyo/takumi); Anonymisierte: `user_deleted_xxx@anonymized.local`
- **Expert**: liveStatus (`offline` \| `available` \| `in_call` \| `busy`); priceVideo15Min, priceVoice15Min
- **Booking**: status (incl. `cancelled_in_handshake`, `instant_expired`); bookingMode (scheduled \| instant)
- **Transaction**: status (AUTHORIZED, CAPTURED, CANCELED, REFUNDED)
- **WalletTransaction**: amountCents (positiv = Credit, negativ = Debit); type (topup, booking_payment, refund)
- **PushSubscription**: endpoint, p256dh, auth für Web Push
- **CronRunLog**: cronName, lastRunAt (Health-Check; release-wallet, experts-offline)
- **AdminActionLog**: Admin-Aktionen (force_capture, manual_release, refund)

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
| [README.md](README.md) | Übersicht, Setup, Features |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architektur, Datenflüsse, API-Übersicht |
| [docs/HIDDEN-MECHANICS.md](docs/HIDDEN-MECHANICS.md) | Verborgene Funktionsweisen: Idempotenz, Session Revocation, Optimistic UI, RBAC, Caching, Instant-Abrechnung, Session Activity, LogoutBackGuard |
| [docs/ADMIN.md](docs/ADMIN.md) | Admin-Layout, Health-Check, DSGVO-Kontoverwaltung, Pause-Logik |
| [docs/ENV.md](docs/ENV.md) | Umgebungsvariablen |
| [docs/DEPLOYMENT-AUTH.md](docs/DEPLOYMENT-AUTH.md) | **Production-Login:** `NEXTAUTH_URL`, www→apex, Safari/WebKit |
| [docs/MOBILE-READINESS.md](docs/MOBILE-READINESS.md) | Mobile-Richtlinien (Capacitor integriert) |
| [docs/MOBILE-BUILD.md](docs/MOBILE-BUILD.md) | Mobile Build (Capacitor) |
| [docs/DEEP-LINKING-SETUP.md](docs/DEEP-LINKING-SETUP.md) | Deep-Links (Waymail, Chat) |
| [docs/SECURE-FILE-EXCHANGE.md](docs/SECURE-FILE-EXCHANGE.md) | Sichere Datei-Übertragung |
| [docs/STORE-COMPLIANCE-CHECKLIST.md](docs/STORE-COMPLIANCE-CHECKLIST.md) | App-Store-Compliance |
| [docs/IOS-APP-STORE-COMPLIANCE.md](docs/IOS-APP-STORE-COMPLIANCE.md) | iOS App Store Compliance |

---

## Deployment

### Vercel (Git)

1. Projekt mit GitHub verbinden
2. Umgebungsvariablen setzen (inkl. `CRON_SECRET` für Cron-Routes)
3. Build: `prisma generate && next build`
4. Stripe Webhook: `checkout.session.completed`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`
5. Cron-Jobs: `vercel.json` definiert `release-wallet`, `experts-offline`, `instant-request-cleanup`; alle benötigen `Authorization: Bearer <CRON_SECRET>`

### Vercel CLI (ohne Git)

```bash
vercel --prod
```

- Lädt lokale Änderungen direkt hoch
- `vercel.json` enthält Cron-Schedules; **Hobby-Plan**: Crons max. 1× täglich pro Route
- `instant-request-cleanup`: `0 8 * * *` (8:00) – für Instant Connect mit 60s-Expiry: externer Cron oder Pro-Plan

### Nach dem ersten Deploy

- `npx prisma migrate deploy` mit Production-DATABASE_URL
- E-Mail-SMTP konfigurieren

---

## Lizenz

Proprietär. Alle Rechte vorbehalten.

---

*Letzte Aktualisierung: März 2026*

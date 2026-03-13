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
- **Sessions**: Daily.co Video/Voice; 5 Min Handshake gratis, danach Zahlungsdialog (Stripe oder Wallet)
- **Handshake-Logik**: &lt; 5 Min → automatische Rückerstattung / Hold-Freigabe; ≥ 5 Min → Capture
- **Wallet**: Guthaben aufladen (Stripe), mit Wallet bei Buchung zahlen; atomare Abzüge mit Balance-Guard
- **Benachrichtigungen**: Buchungsbestätigungen; löschbar; **Push-Benachrichtigungen** (Web Push + Capacitor)
- **Profil**: Favoriten, Sessions; **Konto pausieren** (sofort offline als Takumi); **Konto löschen** (DSGVO-Anonymisierung: Name/E-Mail → Platzhalter, Blob-Bilder gelöscht, Wallet-Historie erhalten)
- **Safety**: Snapshot-Einwilligung, Live-Monitoring; bei Voice entfällt Pre-Check

### Für Takumi (Experten)
- **Profil & Verfügbarkeit**: 15-Min-Intervall-Kalender; Preis Video/Voice pro 15 Min
- **Stornierungsrichtlinie**: Kostenlose Stornierung bis X Stunden, danach Gebühr
- **Buchungsanfragen**: E-Mail + In-App + Push; Annehmen/Ablehnen/Rückfrage
- **Live-Status**: `offline` | `available` | `in_call` | `busy` für Instant Connect
- **Instant Connect**: Anklopfen durch Shugyo; Takumi antwortet live

### Für Admins
- **Admin-Layout** (`app/(app)/admin/layout.tsx`): Dedizierter Guard – NextAuth + Prisma-Rolle; entkoppelt vom Profil
- **Admin-Dashboard** (`/admin`): Nutzer, Buchungen, Experten, Finanzen, DB-Tools
- **Health-Check** (`/admin/health-check`): Live-Monitoring – Cron-Laufzeiten, Stripe-Escrow-Risiken (6+ Tage), Wallet-Integrität, Push-Reachability; Force-Capture pro Buchung
- **Finance Monitoring** (`/admin/finance`): Escrow-Holds, Stripe-Expiry (7 Tage), Shugyo-Wallet-Liability; Force Capture, Manual Release mit Doppelbestätigung
- **Transaction Audit Log**: Stripe, Wallet, Admin-Aktionen; alle Finanz-Ops in `prisma.$transaction`
- **CSV-Export**: Financial CSV (DATEV-ready), ZIP (PDFs), DATEV-CSV
- **Safety Incidents**: Alert-Bilder unter `/admin/safety/incidents`
- **AdminActionLog**: Alle Admin-Aktionen (force_capture, manual_release, refund)

### Technisch
- **i18n**: Deutsch (Master), Englisch, Spanisch
- **Zahlung**: Stripe Hold & Capture (manual capture); Wallet mit atomarem `updateMany` + Balance-Guard; 7-Tage-Stripe-Hold-Fenster
- **Push**: Web Push (VAPID) + Firebase Admin (FCM) für native; Quick Actions (ACCEPT/DECLINE) bei Instant Connect
- **Safety**: Google Vision API (Live-Monitoring), Cloudmersive (Virenscan bei Upload); manueller Report-Button im Call
- **Sicherheit**: Rate-Limiting, Honeypot, bcrypt, Security-Headers
- **Secure File Upload**: `/api/files/secure-upload` mit Cloudmersive-Virenscan, Busboy-Streaming
- **Session-Terminierung**: `/api/sessions/[id]/terminate` für 5-Min-Handshake (Case A) oder Capture (Case B)

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Datenbank | PostgreSQL (Prisma ORM) |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| Zahlung | Stripe (Embedded Checkout, Hold & Capture, Webhooks) |
| Video/Voice | Daily.co (`@daily-co/daily-js`) |
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
│   │   ├── admin/          # Admin (layout.tsx Guard), Dashboard, Health-Check, Finance, Safety, Templates
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
├── components/             # Deep-Link-Handler, Push-Provider, Native-Test-Center
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
- PostgreSQL (z.B. Neon, Supabase)
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
- **User**: balance, pendingBalance (Wallet); appRole (shugyo/takumi); Anonymisierte: `user_deleted_xxx@anonymized.local`
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
| Wallet-Release-Cron | 24h nach Session-Ende: `processPendingCompletions` |

---

## Rollen & Zugriff

| Rolle | Beschreibung |
|-------|--------------|
| **shugyo** | Nutzer: Kategorien, Buchungen, Sessions, Profil |
| **takumi** | Experte: + Verfügbarkeit, Takumi-Profil, Instant Connect |
| **admin** | + Admin-Dashboard, Health-Check, Finance Monitoring, Safety; Admin-Konten sind vor Löschung geschützt |

- `/dashboard/availability`: nur Takumi & Admin
- `/admin`: nur Admin; **Layout-Guard** (`app/(app)/admin/layout.tsx`) prüft NextAuth + Prisma-Rolle serverseitig
- Pausierte Konten: Redirect zu `/paused`; Takumi wird sofort `liveStatus: offline`

---

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| [README.md](README.md) | Übersicht, Setup |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architektur, Datenflüsse, API |
| [docs/ADMIN.md](docs/ADMIN.md) | Admin-Layout, Health-Check, DSGVO-Kontoverwaltung, Pause-Logik |
| [docs/ENV.md](docs/ENV.md) | Umgebungsvariablen |
| [docs/MOBILE-READINESS.md](docs/MOBILE-READINESS.md) | Mobile-Richtlinien (Capacitor bereits integriert) |
| [docs/DEEP-LINKING-SETUP.md](docs/DEEP-LINKING-SETUP.md) | Deep-Links |
| [docs/SECURE-FILE-EXCHANGE.md](docs/SECURE-FILE-EXCHANGE.md) | Sichere Datei-Übertragung |
| [docs/STORE-COMPLIANCE-CHECKLIST.md](docs/STORE-COMPLIANCE-CHECKLIST.md) | App-Store-Compliance (DSGVO, Permissions) |

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

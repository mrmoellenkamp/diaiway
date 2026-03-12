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
- **Instant Connect**: Spontaner Anruf bei verfügbaren Takumis (ohne Terminbuchung)
- **Sessions**: Daily.co Video/Voice; 5 Min Handshake gratis, danach Zahlungsdialog (Stripe oder Wallet)
- **Handshake-Logik**: &lt; 5 Min → automatische Rückerstattung / Hold-Freigabe; ≥ 5 Min → Capture
- **Wallet**: Guthaben aufladen (Stripe), mit Wallet bei Buchung zahlen; atomare Abzüge mit Balance-Guard
- **Benachrichtigungen**: Buchungsbestätigungen; löschbar; **Push-Benachrichtigungen** (Web Push + Capacitor)
- **Profil**: Favoriten, Sessions, Konto pausieren/löschen (DSGVO)
- **Safety**: Snapshot-Einwilligung, Live-Monitoring; bei Voice entfällt Pre-Check

### Für Takumi (Experten)
- **Profil & Verfügbarkeit**: 15-Min-Intervall-Kalender; Preis Video/Voice pro 15 Min
- **Stornierungsrichtlinie**: Kostenlose Stornierung bis X Stunden, danach Gebühr
- **Buchungsanfragen**: E-Mail + In-App + Push; Annehmen/Ablehnen/Rückfrage
- **Live-Status**: `offline` | `available` | `in_call` | `busy` für Instant Connect
- **Instant Connect**: Anklopfen durch Shugyo; Takumi antwortet live

### Für Admins
- **Admin-Dashboard**: Nutzer, Buchungen, Experten, Finanzen, DB-Tools
- **Finance Monitoring** (`/admin/finance`): Escrow-Holds, Stripe-Expiry (7 Tage), Shugyo-Wallet-Liability; Force Capture, Manual Release mit Doppelbestätigung
- **Transaction Audit Log**: Stripe, Wallet, Admin-Aktionen
- **CSV-Export**: Financial CSV (DATEV-ready), ZIP (PDFs), DATEV-CSV
- **Safety Incidents**: Alert-Bilder unter `/admin/safety/incidents`
- **AdminActionLog**: Alle Admin-Aktionen werden protokolliert

### Technisch
- **i18n**: Deutsch (Master), Englisch, Spanisch
- **Zahlung**: Stripe Hold & Capture (manual capture); Wallet mit atomarem `updateMany` + Balance-Guard
- **Push**: Web Push (VAPID) + Capacitor Push Notifications; `/api/push/subscribe`
- **Sicherheit**: Rate-Limiting, Honeypot, bcrypt, Security-Headers
- **Secure File Upload**: `/api/files/secure-upload` mit Cloudmersive-Virenscan, Busboy-Streaming
- **Session-Terminierung**: `/api/sessions/[id]/terminate` für Handshake-Release oder Capture

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Datenbank | PostgreSQL (Prisma ORM) |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| Zahlung | Stripe (Embedded Checkout, Hold & Capture, Webhooks) |
| Video/Voice | Daily.co |
| Mobile | Capacitor 8 (iOS, Android) |
| AI | Vercel AI SDK |
| Storage | Vercel Blob |
| E-Mail | Nodemailer (SMTP) |
| Push | web-push (VAPID), Capacitor Push Notifications |
| UI | Tailwind CSS, Radix UI, Shadcn |
| i18n | Custom (de.ts, en.ts, es.ts) |

---

## Projektstruktur

```
├── app/
│   ├── (app)/              # Geschützte App-Routen
│   │   ├── admin/          # Admin-Dashboard, Finance Monitoring, Safety, Templates
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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push (optional) |
| `EMAIL_*` | SMTP (EMAIL_SERVER_HOST, PORT, USER, PASSWORD, EMAIL_FROM) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (diAIway intelligence) |
| `GOOGLE_CLOUD_VISION_API_KEY` | Vision API (Safety) |
| `CLOUDMERSIVE_API_KEY` | Virenscan bei Secure-Upload (optional) |
| `DAILY_API_KEY` | Daily.co (Video-Sessions) |

Details: [docs/ENV.md](docs/ENV.md)

---

## Datenbank

### Wichtige Modelle
- **User**: balance, pendingBalance (Wallet); appRole (shugyo/takumi)
- **Expert**: liveStatus; priceVideo15Min, priceVoice15Min
- **Booking**: status (incl. `cancelled_in_handshake`); bookingMode (scheduled | instant)
- **Transaction**: status (AUTHORIZED, CAPTURED, CANCELED, REFUNDED)
- **WalletTransaction**: amountCents (positiv = Credit, negativ = Debit); type (topup, booking_payment, refund)
- **PushSubscription**: endpoint, p256dh, auth für Web Push
- **AdminActionLog**: Admin-Aktionen (force_capture, manual_release, finance_export_csv)

```bash
npx prisma generate
npx prisma db push
npx prisma studio
```

---

## Rollen & Zugriff

| Rolle | Beschreibung |
|-------|--------------|
| **shugyo** | Nutzer: Kategorien, Buchungen, Sessions, Profil |
| **takumi** | Experte: + Verfügbarkeit, Takumi-Profil, Instant Connect |
| **admin** | + Admin-Dashboard, Finance Monitoring, Safety |

- `/dashboard/availability`: nur Takumi & Admin
- `/admin`: nur Admin
- Pausierte Konten: Redirect zu `/paused`

---

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| [README.md](README.md) | Übersicht, Setup |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architektur, Datenflüsse, API |
| [docs/ENV.md](docs/ENV.md) | Umgebungsvariablen |
| [docs/MOBILE-READINESS.md](docs/MOBILE-READINESS.md) | Mobile-Richtlinien (Capacitor bereits integriert) |
| [docs/DEEP-LINKING-SETUP.md](docs/DEEP-LINKING-SETUP.md) | Deep-Links |
| [docs/SECURE-FILE-EXCHANGE.md](docs/SECURE-FILE-EXCHANGE.md) | Sichere Datei-Übertragung |

---

## Deployment

### Vercel
1. Projekt mit GitHub verbinden
2. Umgebungsvariablen setzen
3. Build: `prisma generate && next build`
4. Stripe Webhook: `checkout.session.completed`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`

### Nach dem ersten Deploy
- `npx prisma migrate deploy` mit Production-DATABASE_URL
- E-Mail-SMTP konfigurieren

---

## Lizenz

Proprietär. Alle Rechte vorbehalten.

---

*Letzte Aktualisierung: März 2026*

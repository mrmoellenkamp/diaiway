# diAIway

**DIY-Hilfe auf Knopfdruck. Sicher. Schnell. Überall.**

diAIway verbindet Nutzer (Shugyo) mit Experten (Takumi) für Live-Video- und Voice-Beratung. Die Plattform bietet einen AI-Guide (diAIway intelligence), Buchungen, Video- oder Voice-Sessions via Daily.co, Escrow-Zahlungen mit Stripe (Hold & Capture) und mehrsprachige Unterstützung (DE, EN, ES).

---

## Inhaltsverzeichnis

- [Features](#features)
- [Tech-Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Schnellstart](#schnellstart)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Datenbank](#datenbank)
- [Rollen & Zugriff](#rollen--zugriff)
- [Deployment](#deployment)
- [Dokumentation](#dokumentation)

---

## Features

### Für Shugyo (Nutzer)
- **diAIway intelligence**: AI-Mentor für Projektbeschreibung und Expertenempfehlung
- **Kategorien durchsuchen**: 11 Kategorien (Heimwerken, Freizeit & Hobby, Haus & Garten, Auto/Rad/Sport, Elektronik, Mode & Beauty, Haustiere, Familie/Kind/Baby, Unterricht & Kurse, Dienstleistungen, Musik/Film/Bücher)
- **Buchungen**: Termine mit Takumis buchen; **Video oder Voice** als Call-Typ wählbar; Vorauszahlung (Stripe oder Wallet) vor Bestätigung
- **Video- oder Voice-Sessions**: 5 Min Handshake (Probezeit) gratis, dann bezahlte Session via Daily.co; Voice-Calls nutzen Daily Audio (kein Video, kein Pre-Check)
- **Handshake-Overlay**: Nach Probezeit erscheint Zahlungsdialog für Session-Fortsetzung; Stripe Embedded Checkout oder Wallet
- **Wallet**: Guthaben für Rückerstattungen; Zahlung mit Wallet bei Buchung möglich
- **Benachrichtigungen**: Buchungsbestätigungen in Nachrichten
- **Profil**: Favoriten, Sessions, Profilnamen als Links zu `/user/[id]`, Konto pausieren/löschen (DSGVO)
- **Safety**: Snapshot-Einwilligung für diAIway Safety Enforcement (Pre-Check, Live-Monitoring); bei Voice-Calls entfällt Pre-Check

### Für Takumi (Experten)
- **Profil & Verfügbarkeit**: 15-Min-Intervall-Kalender, Routinen, Ausnahmen; **Preis für Video** (pro Session) und **Preis für Voice** (pro 15 Min) separat einstellbar
- **Stornierungsrichtlinie**: Kostenlose Stornierung bis X Stunden vorher, danach X% Gebühr
- **Social Media**: Instagram, TikTok, Facebook etc. verknüpfen
- **Buchungsanfragen**: E-Mail (nach Zahlung) + In-App unter „Nachrichten“ + Button „Annehmen, Ablehnen & Nachfrage“ bei pending-Buchungen in „Geplant“
- **Rückfrage**: Vorab eine Nachricht an den Buchungssteller senden

### Für Admins
- **Admin-Dashboard**: Nutzer, Buchungen, Experten, DB-Metriken verwalten
- **DB-Tools**: Seed, Reset (mit Sicherheitsphrase)
- **Safety Incidents**: Alert-Bilder bei Safety-Verstößen unter `/admin/safety/incidents`
- **Expert-User-Sync**: Verknüpfung von Experten mit Nutzern per E-Mail (bei Admin-Besuch)

### Technisch
- **i18n**: Deutsch (Master), Englisch, Spanisch
- **Zahlung**: Stripe Hold & Capture (manual capture); Webhooks: `checkout.session.completed`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`; bei manual capture `payment_status` = unpaid → trotzdem autorisiert
- **Sicherheit**: Rate-Limiting, Honeypot, bcrypt, Security-Headers
- **Safety Enforcement**: Pre-Check (Vision API vor Daily-Join, nur bei Video), Live-Monitoring, Vercel Blob für Incidents
- **Rechtlich**: Impressum, AGB, Datenschutz, Hilfe-Seite

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Datenbank | PostgreSQL (Prisma ORM) |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| Zahlung | Stripe (Embedded Checkout, Hold & Capture, Webhooks) |
| Video & Audio | Daily.co (Video + Voice-only via DailyAudioCall) |
| AI | Vercel AI SDK |
| Storage | Vercel Blob |
| E-Mail | Nodemailer (SMTP) |
| UI | Tailwind CSS, Radix UI, Shadcn |
| i18n | Custom (de.ts, en.ts, es.ts) |

---

## Projektstruktur

```
├── app/
│   ├── (app)/              # Geschützte App-Routen
│   │   ├── admin/          # Admin-Dashboard
│   │   ├── ai-guide/       # AI-Guide Seite
│   │   ├── booking/[id]/   # Buchungsseite
│   │   ├── categories/     # Kategorien + AI-Mentor
│   │   ├── dashboard/      # Verfügbarkeit (Takumi)
│   │   ├── messages/       # Nachrichten + Benachrichtigungen
│   │   ├── profile/        # Profil & Bearbeitung
│   │   ├── search/         # Suche
│   │   ├── sessions/       # Meine Sessions
│   │   ├── takumi/[id]/    # Takumi-Profil
│   │   └── user/[id]/      # Öffentliches Nutzerprofil
│   ├── api/                # API-Routen
│   │   ├── admin/          # Admin-APIs, Safety Incidents
│   │   ├── auth/           # Auth, Register, Reset
│   │   ├── bookings/       # Buchungen, pay-with-wallet, notify-takumi
│   │   ├── notifications/  # Benachrichtigungen
│   │   ├── safety/         # Pre-Check, Alert-Snapshot
│   │   ├── user/           # Profil, Takumi-Profil, Account
│   │   ├── users/[id]/     # Öffentliches Profil pro User
│   │   └── webhooks/       # Stripe
│   ├── booking/respond/    # Takumi: Buchung annehmen/ablehnen
│   ├── legal/              # Impressum, AGB, Datenschutz
│   └── help/               # Hilfe & Support
├── components/             # React-Komponenten
├── lib/                    # Auth, DB, i18n, E-Mail, Stripe
├── prisma/
│   └── schema.prisma      # DB-Schema
└── public/
```

---

## Schnellstart

### Voraussetzungen
- Node.js 18+
- PostgreSQL (z.B. Neon, Supabase)
- Stripe-, Daily.co-, Vercel-Blob-Accounts (optional für lokale Entwicklung)

### Installation

```bash
# Repository klonen
git clone https://github.com/YOUR_ORG/diaiway.git
cd diaiway

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen einrichten
cp .env.example .env
# .env mit echten Werten füllen (siehe unten)

# Datenbank initialisieren
npx prisma db push
npx prisma generate

# Entwicklungsserver starten
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

---

## Umgebungsvariablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `DATABASE_URL` | PostgreSQL-Verbindungsstring | `postgresql://user:pass@host/db` |
| `NEXTAUTH_SECRET` | Geheimer Schlüssel für JWT | Zufälliger String |
| `NEXTAUTH_URL` | Basis-URL der App | `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Publishable Key | `pk_test_...` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Token | `vercel_blob_...` |
| `EMAIL_SERVER_HOST` | SMTP Host | `smtp.ionos.de` |
| `EMAIL_SERVER_PORT` | SMTP Port | `587` |
| `EMAIL_SERVER_USER` | SMTP User | `user@domain.de` |
| `EMAIL_SERVER_PASSWORD` | SMTP Passwort | `***` |
| `EMAIL_FROM` | Absenderadresse (vollständige Domain) | `info@diaiway.com` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini (diAIway intelligence) | `AIza...` |
| `GOOGLE_CLOUD_VISION_API_KEY` | Vision API (Safety: Pre-Check, Live-Monitoring) | optional |

Details: [docs/ENV.md](docs/ENV.md)

---

## Datenbank

### Schema (Prisma)
- **User**: Auth, Rolle (user/admin), AppRole (shugyo/takumi), Status (active/paused), Wallet, invoiceData
- **Expert**: Takumi-Profil, Kategorie, pricePerSession (Video), priceVoice15Min (Voice), Social Links, Stornierungsrichtlinie
- **Booking**: Buchung, callType (VIDEO \| VOICE), Status, Zahlung, Session, Stornierung, Safety-Einwilligung
- **Review**: Bewertungen
- **Availability**: Verfügbarkeit (15-Min-Slots, Routinen, Ausnahmen)
- **Notification**: Buchungsbenachrichtigungen
- **SafetyIncident**: Alert-Bilder bei Safety-Verstößen (Vercel Blob)

### Befehle

```bash
# Schema in DB pushen
npx prisma db push

# Prisma Client generieren
npx prisma generate

# Prisma Studio (DB-GUI)
npx prisma studio
```

---

## Rollen & Zugriff

| Rolle | Beschreibung | Zugriff |
|-------|--------------|---------|
| **shugyo** | Nutzer | Kategorien, Buchungen, Sessions, Profil |
| **takumi** | Experte | + Verfügbarkeit, Takumi-Profil |
| **admin** | Administrator | + Admin-Dashboard, Nutzerverwaltung |

- `/dashboard/availability`: nur Takumi & Admin
- `/admin`: nur Admin
- Pausierte Konten: Redirect zu `/paused`

---

## Deployment

### Vercel

1. Projekt mit GitHub verbinden
2. Umgebungsvariablen in Vercel setzen
3. Build Command: `prisma generate && next build`
4. `postinstall`: `prisma generate` (falls nötig)

### Nach dem ersten Deploy
- `npx prisma db push` mit Production-DATABASE_URL ausführen
- Stripe Webhook auf `https://your-domain.com/api/webhooks/stripe` zeigen; Events: `checkout.session.completed`, `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`
- E-Mail-SMTP für Produktion konfigurieren

---

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| [README.md](README.md) | Übersicht, Setup, Features |
| [docs/ENV.md](docs/ENV.md) | Umgebungsvariablen |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architektur & Abläufe |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Beitragen & i18n-Sync |
| [docs/MOBILE-READINESS.md](docs/MOBILE-READINESS.md) | iOS/Android-Migration vorbereiten |
| [docs/UPDATE.md](docs/UPDATE.md) | Dokumentation aktuell halten |

---

## Lizenz

Proprietär. Alle Rechte vorbehalten.

---

*Letzte Aktualisierung: März 2026*

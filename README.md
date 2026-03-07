# diAIway

**DIY-Hilfe auf Knopfdruck. Sicher. Schnell. Überall.**

diAIway verbindet Nutzer (Shugyo) mit Experten (Takumi) für Live-Video-Beratung. Die Plattform bietet einen AI-Guide (diAIway intelligence), Buchungen, Video-Sessions via Daily.co, Escrow-Zahlungen mit Stripe und mehrsprachige Unterstützung (DE, EN, ES).

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
- **Kategorien durchsuchen**: Experten nach Fachgebiet finden
- **Buchungen**: Termine mit Takumis buchen, Bestätigung/Ablehnung per E-Mail
- **Video-Sessions**: 5 Min Handshake gratis, dann bezahlte Session (Daily.co)
- **Benachrichtigungen**: Buchungsanfragen und -bestätigungen in Nachrichten mit Alert
- **Profil**: Favoriten, Sessions, Konto pausieren/löschen (DSGVO)

### Für Takumi (Experten)
- **Profil & Verfügbarkeit**: 15-Min-Intervall-Kalender, Routinen, Ausnahmen
- **Stornierungsrichtlinie**: Kostenlose Stornierung bis X Stunden vorher, danach X% Gebühr
- **Social Media**: Instagram, TikTok, Facebook etc. verknüpfen
- **Buchungsanfragen**: Per E-Mail mit Links zum Annehmen/Ablehnen/Rückfragen

### Für Admins
- **Admin-Dashboard**: Nutzer, Buchungen, Experten, DB-Metriken verwalten
- **DB-Tools**: Seed, Reset (mit Sicherheitsphrase)

### Technisch
- **i18n**: Deutsch (Master), Englisch, Spanisch
- **Sicherheit**: Rate-Limiting, Honeypot, bcrypt, Security-Headers
- **Rechtlich**: Impressum, AGB, Datenschutz, Hilfe-Seite

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Datenbank | PostgreSQL (Prisma ORM) |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| Zahlung | Stripe (Checkout, Webhooks) |
| Video | Daily.co |
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
│   │   └── takumi/[id]/    # Takumi-Profil
│   ├── api/                # API-Routen
│   │   ├── admin/          # Admin-APIs
│   │   ├── auth/           # Auth, Register, Reset
│   │   ├── bookings/       # Buchungen
│   │   ├── notifications/  # Benachrichtigungen
│   │   ├── user/           # Profil, Takumi-Profil, Account
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
| `EMAIL_FROM` | Absenderadresse | `info@diaiway.com` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini (diAIway intelligence) | `AIza...` |

Details: [docs/ENV.md](docs/ENV.md)

---

## Datenbank

### Schema (Prisma)
- **User**: Auth, Rolle (user/admin), AppRole (shugyo/takumi), Status (active/paused)
- **Expert**: Takumi-Profil, Kategorie, Preis, Social Links, Stornierungsrichtlinie
- **Booking**: Buchung, Status, Zahlung, Video-Session, Stornierung
- **Review**: Bewertungen
- **Availability**: Verfügbarkeit (15-Min-Slots, Routinen, Ausnahmen)
- **Notification**: Buchungsbenachrichtigungen

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
- Stripe Webhook auf `https://your-domain.com/api/webhooks/stripe` zeigen
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

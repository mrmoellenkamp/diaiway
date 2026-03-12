# diAIway

**DIY-Hilfe auf Knopfdruck. Sicher. Schnell. Überall.**

diAIway verbindet Nutzer (Shugyo) mit Experten (Takumi) für Live-Beratung. Die Plattform bietet einen AI-Guide (diAIway intelligence), Buchungen, Sessions, Escrow-Zahlungen mit Stripe (Hold & Capture) und mehrsprachige Unterstützung (DE, EN, ES).

---

## Inhaltsverzeichnis

- [Features](#features)
- [Tech-Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Schnellstart](#schnellstart)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Datenbank](#datenbank)
- [Rollen & Zugriff](#rollen--zugriff)
- [Core Architecture & Communication](#core-architecture--communication)
- [Deployment](#deployment)
- [Dokumentation](#dokumentation)

---

## Features

### Für Shugyo (Nutzer)
- **diAIway intelligence**: AI-Mentor für Projektbeschreibung und Expertenempfehlung
- **Kategorien durchsuchen**: 11 Kategorien (Heimwerken, Freizeit & Hobby, Haus & Garten, Auto/Rad/Sport, Elektronik, Mode & Beauty, Haustiere, Familie/Kind/Baby, Unterricht & Kurse, Dienstleistungen, Musik/Film/Bücher)
- **Buchungen**: Termine mit Takumis buchen; **Video oder Voice** als Call-Typ wählbar; Vorauszahlung (Stripe oder Wallet) vor Bestätigung
- **Sessions**: 5 Min Handshake (Probezeit) gratis, dann bezahlte Session
- **Handshake-Overlay**: Nach Probezeit erscheint Zahlungsdialog für Session-Fortsetzung; Stripe Embedded Checkout oder Wallet
- **Wallet**: Guthaben für Rückerstattungen; Zahlung mit Wallet bei Buchung möglich
- **Benachrichtigungen**: Buchungsbestätigungen in Nachrichten; einzeln aus der Liste löschbar
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
- **Safety Enforcement**: Live-Monitoring (Vision API), Vercel Blob für Incidents
- **Rechtlich**: Impressum, AGB, Datenschutz, Hilfe-Seite

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Datenbank | PostgreSQL (Prisma ORM) |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| Zahlung | Stripe (Embedded Checkout, Hold & Capture, Webhooks) |
| Sessions | (Neuimplementierung geplant) |
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
│   │   ├── notifications/  # Benachrichtigungen (GET, PATCH, DELETE)
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
- Stripe-, Vercel-Blob-Accounts (optional für lokale Entwicklung)

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
- **Booking**: Buchung, Status, Zahlung, Session, Stornierung
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

## Core Architecture & Communication

### Messaging-Infrastruktur

Alle Nachrichten werden in der Tabelle **DirectMessage** gespeichert. Die Differenzierung erfolgt über das Enum-Feld **`communicationType`**:

| Typ | Bedeutung | Verwendung |
|-----|-----------|------------|
| **CHAT** | Live-Direktansprache | Nur verfügbar, wenn der Empfänger online ist. Schneller, flüchtiger Austausch (z.B. während einer Session). |
| **MAIL** (Waymail) | Formeller Mail-Browser | Immer verfügbar. Asynchroner, dokumentierter Versand. Erfordert zwingend ein Feld `subject` (Betreff). Triggert eine externe E-Mail-Benachrichtigung. |

Waymail-spezifische Felder: `subject` (Pflicht bei MAIL), `senderDisplayName` (z.B. „diAiway System“ für System-Waymails), `senderId` optional (null bei System-Waymails).

---

### Live-Chat Flow

- **UI**: Slide-up Drawer (Bottom Sheet) via vaul auf Mobilgeräten; Inline-Ansicht auf Desktop.
- **Presence**: Polling-basierter Heartbeat (`/api/expert/heartbeat`) alle **20 Sekunden** (Takumi mit `liveStatus === "available"`). `lastSeenAt` wird aktualisiert.
- **30-Sekunden-Timeout**: Ein Nutzer gilt als offline, wenn der Heartbeat länger als **30 Sekunden** ausbleibt. Der „Jetzt chatten“-Button wird nur angezeigt, wenn der Takumi online ist (`isLive && lastSeenAt < 30s`).
- **Offline-Fallback**: Bei offline Empfänger erscheint ein Hinweis mit Link zum Waymail-Editor („Du kannst ihm eine Waymail senden“).
- **Chat-Push**: Bei neuen CHAT-Nachrichten nur Push-Benachrichtigung („X schreibt dir…“), keine E-Mail.
- **Real-time**: Aktuell kein Pusher/WebSocket; Nachrichten werden per Polling/Fetch geladen. WebSockets/Pusher sind für Echtzeit-Refresh optional geplant.

---

### Waymail Flow

- **Asynchron**: Waymails sind jederzeit lesbar; keine Online-Präsenz nötig.
- **Listenansicht** (`/messages` Tab Waymails): Avatar | Betreff (fett) | Vorschau | Zeit. E-Mail-Browser-Layout (kein Chat-Bubble-Design).
- **Deep-Linking**: E-Mail-Benachrichtigung enthält einen Button mit Deep-Link `/messages?waymail={id}`. Die Middleware speichert die vollständige URL in `callbackUrl`; nach Login wird der Nutzer exakt zu dieser Waymail weitergeleitet.
- **Privacy-Konformität**: `sendWaymailNotificationEmail` sendet nur **Absender-Benutzername** und **Betreff**. **Kein Nachrichtentext**, keine E-Mail-Adressen im Inhalt (Content-Leak vermieden). Der Link führt zum Waymail-Reader in der App.
- **Mark-as-Read**: Waymail wird erst beim vollständigen Laden der Detail-Ansicht als gelesen markiert (PATCH `/api/messages?waymail={id}`).

---

### Rollen-System (Shugyo & Takumi)

- **Rollen-agnostisch**: Das Messaging-System arbeitet **nutzer-zu-nutzer**. User und Expert sind über `Expert.userId` verknüpft; die Kommunikation erfolgt über User-IDs (`senderId`, `recipientId`).
- **Richtungen**: Kommunikation ist in alle Kombinationen möglich:
  - **S→T** (Shugyo → Takumi): Buchungsanfragen, Chat während Session
  - **T→S** (Takumi → Shugyo): Bestätigungen, Rückfragen, Waymails
  - **T→T** (Takumi → Takumi): Bei entsprechenden Features möglich
- **Template-Service**: `lib/template-service.ts` nutzt `{{sender_role}}`, `{{recipient_role}}` etc., um Mails unabhängig von der Rollen-Konstellation zu personalisieren.

---

### Security & Assets

**Secure-File-Pipeline** (Chat & Waymail):

1. **Client**: `lib/secure-file-picker.ts` validiert MIME (Bilder, PDF) und **2,5 MB Limit** vor dem Upload.
2. **API** (`/api/files/secure-upload`): Erneute Prüfung von Typ und Größe; **Cloudmersive Virus Scan API** (falls `CLOUDMERSIVE_API_KEY` gesetzt); Thumbnail-Generierung via Sharp.
3. **Error-Handling**:
   - **> 2,5 MB**: „Tipp: Verkleinere das Bild oder PDF, um die maximale Größe von 2,5 MB einzuhalten.“
   - **Viren/API-Fehler**: „Datei konnte nicht verarbeitet werden: Das Dokument entspricht nicht unseren Sicherheitsrichtlinien oder ist beschädigt.“
4. **UI**: Fehlermeldungen erscheinen als roter Hinweistext unter dem Upload-Button; manuelles Schließen per X oder **10-Sekunden-Auto-Dismiss** im Chat-Drawer.

---

### Onboarding & Lifecycle

- **Welcome-Waymail**: Wird ausgelöst, sobald ein neuer Nutzer erfolgreich registriert wurde (`POST /api/auth/register`). Direkt nach `prisma.user.create` wird `sendWelcomeWaymail(user.id)` asynchron aufgerufen.
- **Template-System**: Die Welcome-Waymail nutzt das Template **`welcome-mail`** (aus `lib/template-service.ts` bzw. DB). Bei fehlendem Template wird `seedCommunicationTemplates()` ausgeführt und ein zweiter Versuch unternommen; Fallback auf hardcodierte Strings.

---

### Technical Debt / Next Steps

- **Template-Migration**: Das Multilingual Template System (`CommunicationTemplate`, `TemplateTranslation`) ist implementiert. `lib/onboarding.ts` und `lib/notification-service.ts` (ehemals `notify-takumi.ts`) nutzen bereits `getRenderedTemplate()` und Templates (`welcome-mail`, `booking-request-paid`). **Fallback-Strings** bleiben in beiden Dateien für den Fall, dass das Template-System noch nicht geseedet wurde.
- **Sprachwahl**: Aktuell wird `language: "de"` hardcodet. Geplant: Nutzer-Präferenz bzw. Browser-Sprache für Template-Rendering.
- **Pusher/WebSockets**: Optional für Echtzeit-Chat; aktuell Polling.
- **Admin-Template-Editor**: Unter `/admin/templates` mit Tabs DE/EN/ES, Variablen-Check und Test-Waymail-Funktion verfügbar.

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

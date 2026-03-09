# Architektur

## Übersicht

diAIway ist eine Next.js 16 App mit App Router, PostgreSQL (Prisma), NextAuth.js und mehreren externen Diensten.

## Datenfluss

### Authentifizierung
- **NextAuth.js v5** mit Credentials Provider
- JWT enthält: `id`, `name`, `email`, `role`, `appRole`, `status`
- Middleware prüft geschützte Routen und pausierte Konten

### Buchungsablauf (Vorauszahlung)

1. Shugyo wählt Takumi + Termin + **Call-Typ (Video oder Voice)** → `POST /api/bookings` mit `deferNotification: true`, `callType: "VIDEO" | "VOICE"`
2. Buchung wird mit `paymentStatus: unpaid` erstellt (noch keine E-Mail/Notification)
3. Shugyo zahlt: Stripe Embedded Checkout (Hold & Capture) oder `POST /api/bookings/[id]/pay-with-wallet`
4. Nach Zahlung: Stripe-Webhook (`checkout.session.completed` oder `payment_intent.amount_capturable_updated`) oder `verifySessionPayment` setzt `paymentStatus: paid`; bei manual capture ist `payment_status` = unpaid, aber Session "complete" → Zahlung trotzdem gültig
5. E-Mail an Takumi + Notification via `notifyTakumiAfterPayment` (idempotent)
6. Fallback: Client ruft `POST /api/bookings/[id]/notify-takumi` bei erfolgreicher Zahlung
7. Takumi bestätigt/lehnt ab via:
   - E-Mail-Link: `/booking/respond/[id]?token=...`
   - In-App: Nachrichten-Alert mit Bestätigen/Ablehnen
   - Geplant-Tab: Button „Annehmen, Ablehnen & Nachfrage“ → `/booking/respond/[id]` (Session-Auth)
8. Shugyo erhält E-Mail + Notification
9. Video- oder Voice-Session (Daily.co): max. 5 Min vor Termin startbar, < 5 Min Dauer → Rückerstattung

### Zahlung
- **Stripe**: Embedded Checkout, Hold & Capture (Autorisierung vor Session, Capture nach Session oder 24h via Cron)
- **Wallet**: Shugyo kann mit Guthaben zahlen; Takumi erhält `pendingBalance` bis `processCompletion`

### Video- und Voice-Session
- **Daily.co**: Custom-UI mit CallObject (createCallObject), Lobby-Architektur (startCamera vor join)
- **Lobby**: Kamera-Vorschau (Video) oder Avatar (Voice), „Beitreten“-Button; Timer startet erst bei joined-meeting
- **Raum**: `GET/POST /api/daily/meeting-room` mit callMode (voice|video), Token is_owner: false
- **Voice-only**: Kein Pre-Check (kein Bild nötig), kein Live-Monitoring; Safety-Gateway vereinfacht
- Start nur 5 Min vor Termin (Backend-Validierung)
- Trial 5 Min → **Handshake-Overlay** (Zahlungsdialog) → Stripe Embedded Checkout oder Wallet; bei Erfolg Session fortsetzen
- Unter 5 Min Session + bereits bezahlt → automatische Rückerstattung

### Call-Typen (Booking.callType)
- **VIDEO**: Vollbild-Video via Daily CallObject; Lobby mit Kamera-Vorschau; Pre-Check + Live-Monitoring; cycleCamera für Front/Back
- **VOICE**: Audio-only, Lobby ohne Kamera; kein Pre-Check, kein Monitoring; Takumi hat `priceVoice15Min` (€/15 Min)

### Safety Enforcement
- **Pre-Check**: Vor Daily-Join prüft Vision API ein Shugyo-Bild auf Verstöße (nur bei Video)
- **Live-Monitoring**: Zufällige Snapshots während des Calls; bei Verstößen Speicherung in Vercel Blob (nur bei Video)
- **Admin**: `/admin/safety/incidents` zeigt Alert-Bilder

## API-Übersicht

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/auth/*` | - | NextAuth, Register, Forgot-Password, Reset-Password, Seed-Admin |
| `/api/bookings` | GET, POST | Liste, Erstellen (callType: VIDEO \| VOICE) |
| `/api/bookings?view=takumi` | GET | Nur Buchungen als Takumi |
| `/api/bookings?view=shugyo` | GET | Nur Buchungen als Shugyo |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Detail, start/end-session, cancel |
| `/api/bookings/[id]/pay-with-wallet` | POST | Zahlung mit Shugyo-Wallet |
| `/api/bookings/[id]/notify-takumi` | POST | Takumi nach Zahlung benachrichtigen (idempotent) |
| `/api/bookings/[id]/status` | GET | Buchungsstatus abfragen |
| `/api/bookings/slots` | GET | Verfügbare Slots für Takumi+Datum |
| `/api/booking-respond/[id]` | GET, POST | Token oder Session: bestätigen/ablehnen/rückfragen |
| `/api/daily/room` | GET | Daily.co Raum-URL (Legacy) |
| `/api/daily/meeting-room` | GET, POST | Daily Raum + Token, callMode voice|video; Lobby-Architektur |
| `/api/notifications` | GET, PATCH | Benachrichtigungen, als gelesen markieren |
| `/api/user/*` | - | Profil, Takumi-Profil, Account, Favoriten |
| `/api/users/[id]` | GET | Öffentliches Profil eines Nutzers |
| `/api/wallet/history` | GET | Transaktionshistorie (Takumi) |
| `/api/upload` | POST | Bild-Upload (Profil, AI-Guide) |
| `/api/chat` | POST | AI-Chat (diAIway intelligence) |
| `/api/push/subscribe` | POST | Web-Push-Abonnement |
| `/api/availability` | GET, PATCH | Verfügbarkeit (Takumi) |
| `/api/takumis` | GET, POST | Takumi-Liste, Seed |
| `/api/takumis/seed` | POST | Seed-Daten einspielen |
| `/api/cron/release-wallet` | GET | 24h-Wallet-Freigabe (Bearer CRON_SECRET) |
| `/api/admin/*` | - | Stats, Users, Bookings, Safety Incidents, DB-Tools, Wallet-Refund |
| `/api/admin/safety/incidents` | GET | Alert-Bilder bei Safety-Verstößen |
| `/api/safety/pre-check` | POST | Vision Pre-Check vor Daily-Join (nur bei Video) |
| `/api/safety/alert-snapshot` | POST | Snapshot bei Live-Monitoring-Alert |
| `/api/webhooks/stripe` | POST | checkout.session.completed, payment_intent.amount_capturable_updated, payment_intent.payment_failed |

## Sicherheit

- **Rate-Limiting**: Auth-Endpoints (Register, Login, Forgot-Password)
- **Honeypot**: Anti-Bot bei Formularen
- **Security-Headers**: X-Frame-Options, HSTS, etc. (middleware.ts)
- **DSGVO**: Konto löschen anonymisiert Buchungen, löscht Reviews
- **Safety Enforcement**: Vision API, Vercel Blob für Incident-Speicherung

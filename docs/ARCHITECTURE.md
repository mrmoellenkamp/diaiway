# Architektur

## Übersicht

diAIway ist eine Next.js 16 App mit App Router, PostgreSQL (Prisma), NextAuth.js und mehreren externen Diensten.

## Datenfluss

### Authentifizierung
- **NextAuth.js v5** mit Credentials Provider
- JWT enthält: `id`, `name`, `email`, `role`, `appRole`, `status`
- Middleware prüft geschützte Routen und pausierte Konten

### Buchungsablauf (Vorauszahlung)

1. Shugyo wählt Takumi + Termin → `POST /api/bookings` mit `deferNotification: true`
2. Buchung wird mit `paymentStatus: unpaid` erstellt (noch keine E-Mail/Notification)
3. Shugyo zahlt: Stripe Embedded Checkout (Hold & Capture) oder `POST /api/bookings/[id]/pay-with-wallet`
4. Nach Zahlung: Stripe-Webhook oder `verifySessionPayment` setzt `paymentStatus: paid`
5. E-Mail an Takumi + Notification via `notifyTakumiAfterPayment` (idempotent)
6. Fallback: Client ruft `POST /api/bookings/[id]/notify-takumi` bei erfolgreicher Zahlung
7. Takumi bestätigt/lehnt ab via:
   - E-Mail-Link: `/booking/respond/[id]?token=...`
   - In-App: Nachrichten-Alert mit Bestätigen/Ablehnen
   - Geplant-Tab: Button „Annehmen, Ablehnen & Nachfrage“ → `/booking/respond/[id]` (Session-Auth)
8. Shugyo erhält E-Mail + Notification
9. Video-Session (Daily.co): max. 5 Min vor Termin startbar, < 5 Min Dauer → Rückerstattung

### Zahlung
- **Stripe**: Embedded Checkout, Hold & Capture (Autorisierung vor Session, Capture nach Session oder 24h via Cron)
- **Wallet**: Shugyo kann mit Guthaben zahlen; Takumi erhält `pendingBalance` bis `processCompletion`

### Video-Session
- **Daily.co**: Raum-URL `https://diaiway.daily.co/{bookingId}`
- Start nur 5 Min vor Termin (Backend-Validierung)
- Trial 5 Min → Handshake → Bezahlung oder Ende
- Unter 5 Min Session + bereits bezahlt → automatische Rückerstattung

### Safety Enforcement
- **Pre-Check**: Vor Daily-Join prüft Vision API ein Shugyo-Bild auf Verstöße
- **Live-Monitoring**: Zufällige Snapshots während des Calls; bei Verstößen Speicherung in Vercel Blob
- **Admin**: `/admin/safety/incidents` zeigt Alert-Bilder

## API-Übersicht

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/auth/*` | - | NextAuth, Register, Forgot-Password, Seed-Admin |
| `/api/bookings` | GET, POST | Liste, Erstellen |
| `/api/bookings?view=takumi` | GET | Nur Buchungen als Takumi |
| `/api/bookings?view=shugyo` | GET | Nur Buchungen als Shugyo |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Detail, start/end-session, cancel |
| `/api/bookings/[id]/pay-with-wallet` | POST | Zahlung mit Shugyo-Wallet |
| `/api/bookings/[id]/notify-takumi` | POST | Takumi nach Zahlung benachrichtigen (idempotent) |
| `/api/bookings/slots` | GET | Verfügbare Slots für Takumi+Datum |
| `/api/booking-respond/[id]` | GET, POST | Token oder Session: bestätigen/ablehnen/rückfragen |
| `/api/notifications` | GET, PATCH | Benachrichtigungen, als gelesen markieren |
| `/api/user/*` | - | Profil, Takumi-Profil, Account (pause/delete) |
| `/api/users/[id]` | GET | Öffentliches Profil eines Nutzers |
| `/api/admin/*` | - | Stats, Users, Bookings, Safety Incidents, DB-Tools |
| `/api/admin/safety/incidents` | GET | Alert-Bilder bei Safety-Verstößen |
| `/api/safety/pre-check` | POST | Vision Pre-Check vor Daily-Join |
| `/api/safety/alert-snapshot` | POST | Snapshot bei Live-Monitoring-Alert |
| `/api/webhooks/stripe` | POST | Stripe Webhooks (checkout.session.completed, payment_intent.*) |

## Sicherheit

- **Rate-Limiting**: Auth-Endpoints (Register, Login, Forgot-Password)
- **Honeypot**: Anti-Bot bei Formularen
- **Security-Headers**: X-Frame-Options, HSTS, etc. (middleware.ts)
- **DSGVO**: Konto löschen anonymisiert Buchungen, löscht Reviews
- **Safety Enforcement**: Vision API, Vercel Blob für Incident-Speicherung

# Architektur

## Übersicht

diAIway ist eine Next.js 16 App mit App Router, PostgreSQL (Prisma), NextAuth.js und mehreren externen Diensten.

## Datenfluss

### Authentifizierung
- **NextAuth.js v5** mit Credentials Provider
- JWT enthält: `id`, `name`, `email`, `role`, `appRole`, `status`
- Middleware prüft geschützte Routen und pausierte Konten

### Buchungsablauf
1. Shugyo wählt Takumi + Termin → `POST /api/bookings`
2. E-Mail an Takumi + Notification in DB
3. Takumi bestätigt/lehnt ab via `/booking/respond/[id]?token=...` oder Dashboard
4. Shugyo erhält E-Mail + Notification
5. Zahlung (Stripe Checkout) vor Session
6. Video-Session (Daily.co): max. 5 Min vor Termin startbar, < 5 Min Dauer → Rückerstattung

### Video-Session
- **Daily.co**: Raum-URL `https://diaiway.daily.co/{bookingId}`
- Start nur 5 Min vor Termin (Backend-Validierung)
- Trial 5 Min → Handshake → Bezahlung oder Ende
- Unter 5 Min Session + bereits bezahlt → automatische Rückerstattung

## API-Übersicht

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/auth/*` | - | NextAuth, Register, Forgot-Password |
| `/api/bookings` | GET, POST | Liste, Erstellen |
| `/api/bookings/[id]` | GET, PATCH | Detail, start/end-session, cancel |
| `/api/booking-respond/[id]` | GET, POST | Token-basiert: bestätigen/ablehnen/rückfragen |
| `/api/notifications` | GET, PATCH | Benachrichtigungen, als gelesen markieren |
| `/api/user/*` | - | Profil, Takumi-Profil, Account (pause/delete) |
| `/api/admin/*` | - | Stats, Users, Bookings, DB-Tools |
| `/api/webhooks/stripe` | POST | Stripe Webhooks |

## Sicherheit

- **Rate-Limiting**: Auth-Endpoints (Register, Login, Forgot-Password)
- **Honeypot**: Anti-Bot bei Formularen
- **Security-Headers**: X-Frame-Options, HSTS, etc. (middleware.ts)
- **DSGVO**: Konto löschen anonymisiert Buchungen, löscht Reviews

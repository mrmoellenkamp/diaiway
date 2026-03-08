# Umgebungsvariablen

Alle für diAIway benötigten Umgebungsvariablen.

## Pflicht (Minimum für lokale Entwicklung)

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `DATABASE_URL` | PostgreSQL-Verbindungsstring | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `NEXTAUTH_SECRET` | Geheimer Schlüssel für JWT (min. 32 Zeichen) | Zufälliger String |
| `NEXTAUTH_URL` | Basis-URL der App | `http://localhost:3000` |

## E-Mail (SMTP)

Unterstützt `EMAIL_SERVER_*` (Vercel) und `SMTP_*` (Legacy):

| Variable | Beschreibung |
|----------|--------------|
| `EMAIL_SERVER_HOST` / `SMTP_HOST` | SMTP-Server |
| `EMAIL_SERVER_PORT` / `SMTP_PORT` | Port (587 oder 465 für TLS) |
| `EMAIL_SERVER_USER` / `SMTP_USER` | SMTP-Benutzername |
| `EMAIL_SERVER_PASSWORD` / `SMTP_PASSWORD` | SMTP-Passwort |
| `EMAIL_FROM` / `SMTP_FROM` | Absenderadresse (vollständige Adresse, z.B. `info@diaiway.com`) |

## Stripe

| Variable | Beschreibung |
|----------|--------------|
| `STRIPE_SECRET_KEY` | Stripe Secret Key |
| `STRIPE_WEBHOOK_SECRET` | Webhook-Signatur (für `/api/webhooks/stripe`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable Key (Client) |

**Stripe Webhook Events** (im Dashboard konfigurieren):
- `checkout.session.completed`
- `payment_intent.amount_capturable_updated` (Fallback bei Hold & Capture)
- `payment_intent.payment_failed`

## AI (diAIway intelligence)

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API Key für den AI-Chat |

## Safety Enforcement (Vision API)

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_CLOUD_VISION_API_KEY` | Google Cloud Vision API Key. Wird verwendet für: Pre-Check vor Daily-Join (Shugyo-Bild), Live-Monitoring während des Calls. Ohne Key wird die Prüfung übersprungen. |

## Daily.co (Video & Voice)

| Variable | Beschreibung |
|----------|--------------|
| `DAILY_API_KEY` | Daily.co API Key (Raum-Erstellung) |
| `NEXT_PUBLIC_DAILY_DOMAIN` | z.B. `https://diaiway.daily.co` (für Video- und Voice-Calls) |

## Vercel Blob

| Variable | Beschreibung |
|----------|--------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Token. Wird verwendet für: Profilbilder, Safety-Incident-Alerts (bei Verstößen während Video-Sessions). |

## Admin

| Variable | Beschreibung |
|----------|--------------|
| `ADMIN_PASSWORD` | Schutz für `/api/auth/seed-admin` |

## Web Push (Benachrichtigungen)

| Variable | Beschreibung |
|----------|--------------|
| `VAPID_PUBLIC_KEY` | Öffentlicher VAPID-Key (auch als `NEXT_PUBLIC_VAPID_PUBLIC_KEY` für Client) |
| `VAPID_PRIVATE_KEY` | Privater VAPID-Key (nur serverseitig) |

VAPID-Keys generieren: `node -e "const w=require('web-push');const v=w.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+v.publicKey);console.log('VAPID_PRIVATE_KEY='+v.privateKey);console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY='+v.publicKey);"`

## Optional

| Variable | Beschreibung |
|----------|--------------|
| `CRON_SECRET` | Schützt `GET /api/cron/release-wallet` (24h-Freigabe). Bei Vercel Cron: `Authorization: Bearer <CRON_SECRET>` |
| `TZ` | Timezone (z.B. `Europe/Berlin` für CET/CEST) |

---

*Referenz: `.env.example` im Projektroot*

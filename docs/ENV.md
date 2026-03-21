# Umgebungsvariablen

Alle für diAIway benötigten Umgebungsvariablen.

## Pflicht (Minimum für lokale Entwicklung)

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `DATABASE_URL` | PostgreSQL-Verbindungsstring | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `NEXTAUTH_SECRET` | Geheimer Schlüssel für JWT (min. 32 Zeichen) | Zufälliger String |
| `NEXTAUTH_URL` | Basis-URL der App | `http://localhost:3001` lokal (wie `npm run dev`); **Production:** kanonische URL (z. B. `https://diaiway.com`) — siehe [DEPLOYMENT-AUTH.md](./DEPLOYMENT-AUTH.md) |

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
| `GOOGLE_CLOUD_VISION_API_KEY` | Google Cloud Vision API Key. Wird verwendet für **Safety** (Bild-Upload, Pre-Check, Live-Monitoring) via `lib/vision-safety.ts`. Endpoint: `eu-vision.googleapis.com` (DSGVO). **Fallback:** Wenn nicht gesetzt, werden die Service-Account-Credentials (`GOOGLE_VISION_*`) verwendet. |

## Vision-Scanner & Safety (Service Account)

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_VISION_PROJECT_ID` | Google Cloud Projekt-ID |
| `GOOGLE_VISION_CLIENT_EMAIL` | Service-Account-E-Mail |
| `GOOGLE_VISION_PRIVATE_KEY` | Private Key (PEM, mit `\\n` für Zeilenumbrüche) |

Werden für Admin-Scanner und als **Fallback für Safety** genutzt, wenn `GOOGLE_CLOUD_VISION_API_KEY` nicht gesetzt ist. Mindestens API-Key ODER Service-Account erforderlich.

## Vercel Blob

| Variable | Beschreibung |
|----------|--------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Token. Wird verwendet für: Profilbilder, Safety-Incident-Alerts. |

## Admin

| Variable | Beschreibung |
|----------|--------------|
| `ADMIN_PASSWORD` | Schutz für `/api/auth/seed-admin` |

## Web Push (Benachrichtigungen)

| Variable | Beschreibung |
|----------|--------------|
| `VAPID_PUBLIC_KEY` | Öffentlicher VAPID-Key (auch als `NEXT_PUBLIC_VAPID_PUBLIC_KEY` für Client) |
| `VAPID_PRIVATE_KEY` | Privater VAPID-Key (nur serverseitig) |

## FCM (Native Push / Quick Actions)

| Variable | Beschreibung |
|----------|--------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Service Account JSON (als String) für FCM |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternativ: Pfad zur Service-Account-JSON-Datei |

VAPID-Keys generieren: `node -e "const w=require('web-push');const v=w.generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+v.publicKey);console.log('VAPID_PRIVATE_KEY='+v.privateKey);console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY='+v.publicKey);"`

## Daily.co (Video/Voice)

| Variable | Beschreibung |
|----------|--------------|
| `DAILY_API_KEY` | Daily.co API Key für Räume und Tokens |
| `DAILY_WEBHOOK_SECRET` | HMAC-Geheimnis zur Signaturprüfung von `/api/webhooks/daily` (BASE-64). Im Daily-Dashboard unter Webhooks abrufbar. |

**Daily Webhook Events** (im Daily-Dashboard konfigurieren):
- `participant.left`, `participant.joined` (Ghost-Session: 60s Wartezeit auf Rejoin)
- `meeting.ended` (sofortige Terminierung)

## Optional

| Variable | Beschreibung |
|----------|--------------|
| `CRON_SECRET` | Schützt Cron-Endpoints (`/api/cron/release-wallet`, `/api/cron/daily-ghost-sessions`). Bei Vercel Cron: `Authorization: Bearer <CRON_SECRET>` |
| `DAILY_GHOST_SECRET` | Alternative zu CRON_SECRET nur für `/api/cron/daily-ghost-sessions` |
| `TZ` | Timezone (z.B. `Europe/Berlin` für CET/CEST) |

---

*Referenz: `.env.example` im Projektroot*

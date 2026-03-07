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
| `EMAIL_SERVER_PORT` / `SMTP_PORT` | Port (z.B. 587) |
| `EMAIL_SERVER_USER` / `SMTP_USER` | SMTP-Benutzername |
| `EMAIL_SERVER_PASSWORD` / `SMTP_PASSWORD` | SMTP-Passwort |
| `EMAIL_FROM` / `SMTP_FROM` | Absenderadresse |

## Stripe

| Variable | Beschreibung |
|----------|--------------|
| `STRIPE_SECRET_KEY` | Stripe Secret Key |
| `STRIPE_WEBHOOK_SECRET` | Webhook-Signatur (für `/api/webhooks/stripe`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable Key (Client) |

## AI (diAIway intelligence)

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API Key |

## Content Safety (Bild-Moderation)

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_CLOUD_VISION_API_KEY` | Google Cloud Vision API Key (SafeSearch). Prüft hochgeladene Bilder auf explizite Inhalte. Ohne Key wird die Prüfung übersprungen. |

## Content Safety (Bild-Moderation)

| Variable | Beschreibung |
|----------|--------------|
| `GOOGLE_CLOUD_VISION_API_KEY` | Google Cloud Vision API Key (SafeSearch). Prüft hochgeladene Bilder auf explizite Inhalte. Ohne Key wird die Prüfung übersprungen. |

## Daily.co (Video)

| Variable | Beschreibung |
|----------|--------------|
| `DAILY_API_KEY` | Daily.co API Key |
| `NEXT_PUBLIC_DAILY_DOMAIN` | z.B. `https://diaiway.daily.co` |

## Vercel Blob (Bilder)

| Variable | Beschreibung |
|----------|--------------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Token |

## Admin

| Variable | Beschreibung |
|----------|--------------|
| `ADMIN_PASSWORD` | Schutz für `/api/auth/seed-admin` |

---

*Referenz: `.env.example` im Projektroot*

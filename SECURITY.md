# Security Policy – diAIway

Dieses Dokument beschreibt das Sicherheits­konzept der diAIway‑Plattform
(Web + Native iOS/Android via Capacitor, Hosting auf Vercel, Postgres via
Prisma, Upstash Redis, Vercel Blob, Stripe Connect, Daily.co).

Es dient gleichzeitig als **internes Security‑Playbook** und als externe
Anlaufstelle für Sicherheits­forschende.

---

## 1. Verantwortliche Offenlegung (Responsible Disclosure)

Bitte melde Schwachstellen **vertraulich** und **bevor** sie öffentlich
gemacht werden:

- **E‑Mail:** `security@diaiway.com`
- **Antwortzeit:** i. d. R. innerhalb von 72 Stunden
- **Bitte keine Demo gegen echte Nutzerdaten** – nutze eigene Test­accounts.
- **Nicht erlaubt:** DoS‑Angriffe, automatisiertes Hoch­lasten,
  Social‑Engineering von Mitarbeitenden.

Wir anerkennen verantwortungsvolle Meldungen gerne in einem Hall‑of‑Fame
(auf Wunsch anonym).

---

## 2. Geltungsbereich

| Bereich                              | In Scope | Hinweise                                |
| ------------------------------------ | :------: | --------------------------------------- |
| `https://diaiway.com` + Subdomains   |   Ja     | Produktiv                               |
| iOS/Android Apps (Capacitor)         |   Ja     | gleiche API wie Web                     |
| `*.vercel.app` Preview‑Deployments   |   Ja     | nicht für Last‑Tests                    |
| Third‑Party (Stripe, Daily.co, …)    |  Nein    | dort direkt melden                      |

---

## 3. Bedrohungsmodell (Kurzfassung)

Primäre Schutz­ziele:

1. **Vertraulichkeit** personen­bezogener Daten (DSGVO Art. 5, 32).
2. **Integrität** von Buchungen, Zahlungen und Nachrichten.
3. **Verfügbarkeit** des Anklopf‑ und Sitzungs­flows.
4. **Konformität** mit Apple App Store, Google Play und EU‑Recht
   (DSA, DSGVO, TMG).

Angreifer­profile, gegen die explizit gehärtet wird:

- Externe Dritte (Credential‑Stuffing, Scraping, SSRF, XSS).
- Böswillige Nutzer (Privilege Escalation, IDOR, Preis­manipulation,
  Spam/Flood, Contact‑Leaking außerhalb der Plattform).
- Kompromittierte Dienste (ausgelaufene Tokens in Logs, Webhook‑Spoofing).

---

## 4. Architektur‑ und Produkt‑Sicherheits­maßnahmen

### 4.1 Transport & Netzwerk

- **HTTPS erzwungen** durch Vercel und `Strict-Transport-Security` mit
  `preload; includeSubDomains`.
- **Redirects** werden zentral in `middleware.ts` verarbeitet; der Pfad
  `/.well-known/*` wird **nie** weitergeleitet, damit App‑Link‑Verifikation
  (Google / Apple) stabil funktioniert.

### 4.2 Header / Browser‑Hardening

Gesetzt in `middleware.ts`:

- **CSP** mit per Request generiertem **Nonce** und `'strict-dynamic'`;
  `'unsafe-eval'` ist **entfernt**. `'unsafe-inline'` bleibt als Fallback
  für ältere Browser, wird aber durch `'strict-dynamic'` ignoriert.
- **`X-Frame-Options: DENY`** und **`X-Content-Type-Options: nosniff`**.
- **`X-XSS-Protection: 0`** – der veraltete Header ist absichtlich auf
  `0`, da er in älteren Browsern neue XSS‑Vektoren eröffnen kann.
- **Referrer‑Policy**, **Permissions‑Policy** und **COOP/CORP** restriktiv.

### 4.3 Authentifizierung

- **NextAuth** mit JWT‑Session, `HttpOnly` + `Secure` + `SameSite=Lax`
  Cookies.
- Passwörter mit **bcrypt 12 Rounds** gehasht.
- **Rate‑Limits**:
  - Login: 10 Versuche / 15 min **pro E‑Mail** + 30 Versuche / 15 min
    **pro IP** (Upstash Redis, IP‑Fallback im Memory).
  - Register / Forgot / Reset: zusätzliche IP‑ und E‑Mail‑Buckets.
  - Seed‑Admin: 5 / Stunde pro IP.
- **Timing‑Safe Compare** (`lib/timing-safe.ts`) für alle Secret‑Checks
  (Cron‑Tokens, Admin‑Seed‑Passwort, Webhook‑Signaturen).
- **E‑Mail‑Verifikation** per Einweg‑Token, TTL 24 h.
- **Passwort‑Reset**: SHA‑256‑gehashter Token, TTL 60 min, einmalige
  Verwendung, Timing‑Hash auch bei Miss.
- **Inaktivitäts‑Timeout** (`LAST_ACTIVITY_COOKIE`, 15 min) für
  shugyo/takumi‑Sitzungen; Heartbeat nur mit Auth.

### 4.4 Autorisierung

- **RBAC** über `role` (`user` | `admin`) und `appRole` (`shugyo` |
  `takumi`).
- Admin‑Routen verwenden zentral **`requireAdmin()`** (kein manueller
  Role‑Check mehr).
- IDOR‑Schutz: alle DB‑Abfragen auf geschützte Objekte scopen auf
  `userId: session.user.id` oder prüfen Ownership explizit.
- **Cron‑Routen** sind durch `assertCronAuthorized()` geschützt; Secrets
  sind per ENV konfiguriert, Vergleich timing‑safe.

### 4.5 Eingabe­validierung

- Validierung **immer server­seitig** via **Zod** (`lib/schemas/*`).
- Bekannte Schemas:
  `createBookingSchema`, `patchProfileSchema`, `sendMessageSchema`,
  `uploadFolderSchema`, `imageUrlSchema` (Allowlist für Vercel‑Blob).
- Längen­grenzen (Notes, Descriptions, Titles) explizit gesetzt.
- Kontakt‑Leak‑Filter (`validateNoContactLeak`) prüft Messages und
  Portfolios auf Versuch, Zahlungen an der Plattform vorbei zu leiten.

### 4.6 Rate Limiting (pro Route)

Zentraler Helper: `lib/api-rate-limit.ts` → limitiert gleichzeitig pro
`userId` **und** pro IP, damit ein kompromittierter Account nicht durch
IP‑Wechsel umgangen werden kann und umgekehrt.

Aktuelle Buckets (Stand heute, siehe Code als Quelle der Wahrheit):

| Endpoint                                  | Limit                |
| ----------------------------------------- | -------------------- |
| `POST /api/bookings`                      | 30 / Std (User+IP)   |
| `PATCH /api/user/profile`                 | 30 / Std (User+IP)   |
| `POST /api/messages`                      | 60 / 10 min (User+IP) |
| `POST /api/upload`                        | 40 / Std (User+IP)   |
| `POST /api/files/secure-upload`           | siehe Route          |
| `GET  /api/files/signed`                  | IP‑Limit             |
| `GET  /api/users/[id]`                    | 120 / min (User), 60 / min (Anon‑IP) |
| `POST /api/analytics/beacon`              | 600 / 10 min (IP)    |
| `POST /api/push/subscribe` + FCM          | 20 / Std (User+IP)   |
| `POST /api/user/favorites`                | 120 / 10 min (User+IP) |
| `PATCH/DELETE /api/notifications`         | 60–120 / 10 min      |
| `GET  /api/auth/heartbeat`                | 180 / min (User)     |
| `POST /api/expert/heartbeat`              | 60 / min (User)      |
| `POST /api/takumi/portfolio`              | 30 / Std (User+IP)   |
| `POST /api/shugyo/projects`               | 30 / Std (User+IP)   |
| `POST /api/auth/seed-admin`               | 5 / Std (IP)         |
| Login / Register / Forgot / Reset          | siehe Code           |

Alle Limits laufen über **Upstash Redis** (global, instanz­übergreifend),
mit **In‑Memory‑Fallback**, damit Ausfälle von Upstash nicht den Login
blockieren.

### 4.7 Datei‑Uploads

- **Bilder‑Upload** (`/api/upload`):
  - Größen­limit 4 MiB (unter Vercel‑Body‑Limit).
  - **Magic‑Byte‑Prüfung** mit `sharp` – der Client‑MIME ist nicht
    vertrauens­würdig.
  - Server­seitige Optimierung (EXIF entfernen, max. 2048 px, JPEG).
  - Allowlist der Zielordner via `uploadFolderSchema`.
- **Dokumente** (`/api/files/secure-upload`):
  - **HMAC‑signierte Proxy‑URLs** via `lib/signed-url.ts`, TTL 1 h,
    gebunden an den `userId`.
  - Clients erhalten **niemals** die rohe `blob.vercel-storage.com`‑URL
    in Prod‑Flows – sie gehen stattdessen durch
    `/api/files/signed`, das Signatur, TTL und Owner prüft.
  - Optional: Cloudmersive Virus‑Scan.
- **Profil‑/Portfolio‑Bilder**: `imageUrlSchema` erlaubt nur Vercel‑Blob
  oder die signierte Proxy‑URL – kein SSRF/Privacy‑Leak über fremde
  Image‑Hosts.

### 4.8 Zahlungen (Stripe)

- **Stripe Webhooks** signaturgeprüft (`stripe.webhooks.constructEvent`).
- **Preise werden serverseitig berechnet** (`app/api/bookings/route.ts`) –
  Client‑Werte `totalPrice`/`price` werden ignoriert (Schutz vor
  DevTools‑Manipulation).
- **Stripe Connect**: eigenes Webhook‑Ende mit getrennter Signature.
- **Idempotenz**: `X-Idempotency-Key` auf `POST /api/bookings`.

### 4.9 Webhooks

- **Stripe + Stripe Connect**: Signature‑Verifikation zwingend.
- **Daily.co**: HMAC‑Vergleich **mit explizitem Längen‑Check vor**
  `crypto.timingSafeEqual` – vermeidet `TypeError` und erzwingt Konstanz.
- **Alle Webhook‑Handler** nutzen `logSecureError` / `logSecureWarn`.

### 4.10 Logging & Telemetrie

- Alle Fehler‑Logs gehen über `lib/log-redact.ts`, das per Regex
  Connection‑Strings, API‑Keys, JWTs und Passwort‑Muster maskiert.
- In Dev wie Prod werden **keine rohen Secrets, DB‑URLs oder Tokens**
  geloggt.
- IP‑Adressen werden bei Registrierungen als **SHA‑256‑Hash** gespeichert
  (siehe `lib/registration-ip-hash.ts`) – keine Klartext‑IPs in der DB.

### 4.11 Gast‑Checkout & sensible Laufzeitdaten

- Gast‑Passwörter und temporäre Rechnungs­daten werden **nicht** in der
  Datenbank (nicht in `booking.note`) abgelegt, sondern in **Upstash
  Redis mit kurzer TTL** (`lib/guest-checkout-store.ts`).
- Zugriff nur **atomar** (`takeGuestCheckoutData`) durch den Stripe‑
  Webhook, damit die Daten nach dem Account‑Anlegen sofort gelöscht sind.

### 4.12 DSGVO‑relevante Kontrollen

- Art. 8 DSGVO: Alters­prüfung (≥ 18) bei Registrierung Pflicht.
- Art. 15 DSGVO: Datenexport via `/api/user/export`.
- Art. 17 DSGVO: Lösch­pfad über Admin + Cron (`cron/purge-expired-documents`).
- Rechts­versionierung der Einwilligung (`acceptedAgbVersion`,
  `acceptedPrivacyVersion`).
- **Keine Klartext‑Secrets in Logs** (siehe `lib/log-redact.ts`).

---

## 5. Compliance‑Hinweise

### 5.1 Google Play

- Digital Asset Links unter `/.well-known/assetlinks.json` (ohne Redirect
  – durch `middleware.ts` garantiert).
- Kein Tracking ohne Consent.
- Passwort‑Reset‑Links laufen über HTTPS und SHA‑256‑Tokens (einmalig).

### 5.2 Apple App Store

- Apple‑Universal‑Links über `/.well-known/apple-app-site-association`
  (gleiche Bypass‑Regel wie oben).
- Keine Umgehung des In‑App‑Kaufs: Digital‑Goods laufen über Stripe nur
  für Web; Apple‑Zahlungsflows sind den iOS‑Apps vorbehalten.

### 5.3 EU‑Recht

- Impressum/AGB/Datenschutz versioniert; Consent‑Flows dokumentiert.
- **Datenminimierung**: Logs ohne PII, IP nur als Hash, Gast‑Daten in
  Upstash mit TTL.

---

## 6. Geheimnisse & Konfiguration

- Alle Secrets leben in **Vercel Environment Variables** (Production /
  Preview getrennt):
  - `DATABASE_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`,
    `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
    `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
    `BLOB_READ_WRITE_TOKEN`, `FILE_SIGNING_SECRET` (optional; sonst
    Fallback auf `NEXTAUTH_SECRET`), `DAILY_API_KEY`, `DAILY_WEBHOOK_SECRET`,
    …
- **Keine `.env.production`** im Repo; nur `.env.example` mit Platz­haltern.
- **`FILE_SIGNING_SECRET` rotieren** erzwingt Neuausgabe aller signierten
  URLs – Altlinks werden dadurch unbrauchbar.

---

## 7. Was zu tun ist bei …

### 7.1 … kompromittiertem Secret

1. In Vercel → Settings → Environment Variables **neuen Wert** setzen.
2. `Redeploy` auslösen (damit neue Serverless‑Instanzen greifen).
3. Bei Stripe‑Webhook‑Secret: auch im Stripe‑Dashboard rotieren.
4. Log‑Durchsicht (Vercel Logs), `logSecureError` Einträge prüfen.

### 7.2 … auffälligem Traffic

1. Upstash‑Dashboard: Rate‑Limit‑Buckets auf Auffälligkeiten prüfen.
2. Bei Bedarf Bucket‑Limits in `lib/api-rate-limit.ts` anpassen und
   deployen.
3. Admin‑Analytics → Visitor‑Sessions → IP‑Muster prüfen.

### 7.3 … Bug‑Report durch Nutzer

1. Reproduzieren (Test‑Account).
2. Issue mit **`[security]`‑Label** anlegen, Schwere einschätzen
   (CVSS‑grob).
3. Fix auf `dev`‑Branch, PR, CI, anschließend Production‑Deploy.

---

## 8. Review‑Kadenz

- **Quartalsweise** Durchsicht dieses Dokuments.
- **Bei jedem neuen API‑Endpoint**: Rate‑Limit + Zod + `logSecureError`
  als Pflicht‑Checklist (siehe Code‑Reviews).
- **Vor jedem Release**: `npm audit` + Lint + Type‑Check.

---

_Stand: automatisch gepflegt im Rahmen des Security‑Audits._

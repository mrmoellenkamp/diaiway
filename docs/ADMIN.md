# Admin-Bereich – Architektur & Kontoverwaltung

**Stand:** März 2026

---

## 1. Admin-Layout & Zugriffskontrolle

### Struktur

```
app/(app)/admin/
├── layout.tsx          # Dediziertes Admin-Layout (Server Component)
├── page.tsx            # Haupt-Dashboard
├── health-check/       # Live-Checks (Cron, Stripe, Wallet, Push)
├── finance/
├── safety/
├── safety/incidents/
└── templates/
```

### Layout-Guard (`app/(app)/admin/layout.tsx`)

- **Server Component** – prüft vor dem Rendern aller Admin-Seiten
- **Auth-Check**: `auth()` (NextAuth v5), Session muss vorhanden sein
- **Role-Check**: `session.user.role === "admin"`
- **Defense-in-Depth**: Zusätzlicher Prisma-Check `User.role` (JWT könnte veraltet sein)
- **Redirects**:
  - Nicht eingeloggt → `/login?callbackUrl=/admin`
  - Kein Admin → `/home`

### Middleware

- `middleware.ts`: Prüft `/admin/*` vor dem Layout
- Gleicher Check: nicht eingeloggt → Login; `role !== "admin"` → `/home`

### GlobalNav

- Admin-Seiten nutzen `admin.title` (i18n) statt `profile.adminDashboard`
- Klare Trennung zwischen Profil- und Admin-Bereich

---

## 2. Health-Check (`/admin/health-check`)

Live-Monitoring für kritische Systemkomponenten.

### CRON-MONITOR

- **Quelle**: `CronRunLog` (Prisma)
- **Logs**: `release-wallet`, `experts-offline`, `cleanup-safety-data`
- **Anzeige**: Letzter Laufzeitpunkt pro Cron
- **Cron-Routen** schreiben nach jedem Lauf `upsert` in `CronRunLog`

### STRIPE-ESCROW-CHECK

- Buchungen mit `paymentStatus: paid`, `paidAt` älter als 6 Tage
- Transaktion noch `AUTHORIZED` oder `PENDING` (Gefahr: 7-Tage-Stripe-Expiry)
- **Force Capture**: Button pro Buchung → `POST /api/admin/finance/force-capture` mit `bookingId`

### WALLET-INTEGRITY

- Summe `WalletTransaction.amountCents` pro User vs. `User.balance`
- Diskrepanzen werden rot markiert

### PUSH-REACHABILITY

- Anteil aktiver Takumis (`liveStatus: available`) ohne gültige `PushSubscription` oder `FcmToken`
- Experten ohne `userId` werden als „ohne Push“ gezählt

### Technik

- `GET /api/admin/health-check` – Admin-only
- Shadcn Tables, Lucide Icons
- Force-Capture mit Bestätigungs-Dialog

---

## 3. Finanz-Operationen & Transaktionen

### Prisma-Transaktionen

Alle DB-Schreibzugriffe in Admin-Finanz-Routen laufen in `prisma.$transaction`:

| Route | Transaktion |
|-------|-------------|
| `force-capture` | `AdminActionLog.create` in `$transaction` |
| `refund` | `booking.update` + `AdminActionLog.create` atomar |
| `manual-release` | Bereits: `booking.update` + `AdminActionLog.create` |

Stripe-Aufrufe bleiben extern; Fehler werden geloggt, die App stürzt nicht ab.

### AdminActionLog

- Aktionen: `force_capture`, `manual_release`, `refund`
- `targetType`, `targetId`, `details` für Audit

### Wallet-Auflade-Limit

- **Maximum**: 100 € pro Aufladung (psychologische Grenze)
- **Frontend** (`components/wallet-topup-modal.tsx`): Buttons [20, 40, 60, 100 €]; Input max 100 €; 200 € entfernt
- **Backend** (`/api/wallet/topup`): `MAX_AMOUNT_CENTS = 10000`; Beträge > 100 € → HTTP 400

---

## 4. DSGVO-konforme Kontoverwaltung

### Anonymisierung statt Hard-Delete

- **Kein Löschen** des User-Records – Wallet-Historie bleibt erhalten (§ 147 AO)
- **Implementierung**: `lib/anonymize-user.ts`

### Ablauf (`anonymizeUser`)

1. **Admin-Check**: `role === "admin"` → Fehlermeldung, kein Anonymisieren
2. **DB-Transaktion** (atomar):
   - Buchungen (Shugyo): `userName`, `userEmail` → Platzhalter
   - Buchungen (Takumi): `expertName`, `expertEmail` → Platzhalter
   - Reviews (von User + über Expert) löschen
   - Availability löschen
   - Expert anonymisieren: `name`, `email`, `avatar`, `imageUrl`, `bio`, `isLive`, `liveStatus`
   - **WalletTransactions**: `referenceId → null`, `metadata → null` (DSGVO Art. 5 Abs. 1 lit. c – Datenminimierung; `amountCents` + `type` bleiben für § 147 AO)
   - User anonymisieren: `name`, `email`, `password` (random hash), `image`, `resetToken`, `invoiceData`, `favorites`, `status`, `tokenRevocationTime` (alle Sessions ungültig)
3. **Blob-Löschung** (nach Transaktion): `del()` für User.image, Expert.avatar, Expert.imageUrl (nur Vercel-Blob-URLs)

### Platzhalter-Format

- **Name**: `user_deleted_<suffix>` (suffix = letzte 12 Zeichen der User-ID, bereinigt)
- **E-Mail**: `user_deleted_<suffix>@anonymized.local` (eindeutig)

### Aufrufer

| Route | Kontext |
|-------|---------|
| `DELETE /api/user/account` | Selbstlöschung (Nutzer) |
| `DELETE /api/admin/users/[id]` | Admin-Löschung |

### Admin-Schutz

- Admin-Konten werden **nicht** anonymisiert
- Fehlermeldung: *„Admin-Konten können aus Sicherheitsgründen nicht gelöscht werden.“*
- Gilt für Selbst- und Admin-Löschung

### Admin-Dashboard: Anonymisierte Nutzer erkennen

- **Badge**: „Anonymisiert“ (grau)
- **E-Mail**: endet mit `@anonymized.local`
- **Name**: `user_deleted_xxxxx`
- Kein Löschen-Button (bereits anonymisiert)
- Kein Löschen-Button bei Admin-Rolle

---

## 5. DSGVO-Cleanup-Cron

### `cleanup-safety-data` (täglich, 03:00 UTC)

**Route**: `app/api/cron/cleanup-safety-data/route.ts`  
**Zweck**: Automatische Datenlöschung nach dem DSGVO-Grundsatz der Speicherbegrenzung (Art. 5 Abs. 1 lit. e)

**Ablauf**:
1. Alle `SafetyIncident`-Einträge auslesen → Schutzliste der gebundenen Blob-URLs
2. Alle Blobs im Prefix `safety-incidents/` paginiert auflisten
3. Blobs **älter als 48 h** und **nicht in der Schutzliste** → löschen (bis zu 50 parallel)
4. `CronRunLog` upsert nach jedem Lauf

**Kriterium**: `uploadedAt < now - 48h` AND `url not in SafetyIncident.imageUrl`  
**Cron-Schedule**: `"0 3 * * *"` (vercel.json)

---

## 6. Pause-Logik

### PATCH `/api/user/account` – `action: "pause"`

- `User.status` → `paused`
- **Takumi**: `Expert.isLive` → `false`, `Expert.liveStatus` → `"offline"`
- **Sofortige Auswirkung**: Takumi erscheint nicht mehr im Instant-Connect

### Resume

- `User.status` → `active`
- `liveStatus` bleibt unverändert (Takumi muss manuell wieder auf „available“ gehen)

---

## 6. API-Routen (Admin, ergänzend)

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/admin/health-check` | GET | Cron, Stripe-Escrow, Wallet-Integrität, Push-Reachability |
| `/api/admin/users/[id]` | DELETE | Anonymisierung (nicht Admin), Blob-Delete |
| `/api/user/account` | PATCH | Pause/Resume (inkl. liveStatus offline) |
| `/api/user/account` | DELETE | Selbstlöschung (Anonymisierung) |

---

## 7. Cron & Vercel Hobby-Limit

### vercel.json

```json
{
  "crons": [
    { "path": "/api/cron/release-wallet", "schedule": "0 6 * * *" },
    { "path": "/api/cron/experts-offline", "schedule": "0 7 * * *" },
    { "path": "/api/cron/instant-request-cleanup", "schedule": "0 8 * * *" }
  ]
}
```

### Hobby-Plan

- Vercel Hobby: Crons maximal **1× täglich**
- `instant-request-cleanup` läuft um **8:00** statt alle 2 Minuten
- **Für Instant Connect mit 60s-Expiry**: Externer Cron (z.B. cron-job.org) oder Vercel Pro

---

*Letzte Aktualisierung: März 2026*

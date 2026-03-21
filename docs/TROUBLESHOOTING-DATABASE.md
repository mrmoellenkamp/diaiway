# Datenbank: Verbindungsfehler (Neon, P1001)

## Symptome in den Logs

- `PrismaClientInitializationError` / `Can't reach database server at *.neon.tech:5432`
- `PrismaClientKnownRequestError` mit Code **`P1001`**
- API-Routen liefern **500** oder **503** (`DATABASE_UNAVAILABLE`)
- **`POST /api/analytics/beacon` mit 200**, daneben trotzdem **`[auth] DB-Sync-Error`**: Der Beacon kann OK sein, während andere Requests die DB brauchen; der JWT-Callback versucht alle ~5 Min. einen DB-Sync — schlägt die DB fehl, bleibt die Session aus dem Token nutzbar.

## Setup (Neon)

Die App nutzt **[Neon](https://neon.tech)** als PostgreSQL-Provider (Region: `eu-central-1`, Frankfurt).

Prisma braucht **zwei** Umgebungsvariablen:

| Variable | Wert | Zweck |
|---|---|---|
| `DATABASE_URL` | Neon **Pooler**-URL (`*-pooler.*.neon.tech`) | Runtime / Serverless |
| `DIRECT_URL` | Neon **Direct**-URL (`*.neon.tech`, ohne `-pooler`) | Migrationen |

Beide URLs findest du im [Neon Dashboard](https://console.neon.tech) → Connection Details.

## Checkliste bei Verbindungsproblemen

1. **Vercel** → Project → **Settings → Environment Variables**
   - `DATABASE_URL` = Neon Pooler-URL (mit `-pooler` im Hostnamen, `sslmode=require`)
   - `DIRECT_URL` = Neon Direct-URL (ohne `-pooler`, `sslmode=require`)
   - Nach Änderung: **Redeploy** auslösen (Vercel baut Serverless-Funktionen mit neuen Werten)

2. **Neon Dashboard** prüfen
   - Projekt **aktiv** (kein Suspend/Pause auf Free Tier)
   - Branch `main` → Compute **Running**

3. **Migration fehlgeschlagen?**
   - Vercel-Build-Log auf `P3009` oder `P3018` prüfen
   - Im Neon SQL Editor: `SELECT * FROM "_prisma_migrations" ORDER BY started_at;`
   - Fehlgeschlagene Migration löschen: `DELETE FROM "_prisma_migrations" WHERE migration_name = '<name>';`
   - Dann neu deployen

4. **Selbsttest (Admin)**
   Als Admin eingeloggt: **`GET /api/admin/db-health`** — zeigt Host und ob `SELECT 1` klappt (`dbOk`). Probe hat **Timeout ~8 s**; bei hängender Verbindung erscheint `dbError` statt endlosem Warten.

5. **Liveness-Check**
   **`GET /api/health`** antwortet **immer mit HTTP 200**, sobald die App läuft. `database.connected: false` bedeutet nur: Postgres nicht erreichbar — nützlich für Monitoring.

## Kurzfassung

Der Fehler ist **kein Bug in der App-Logik**, sondern eine nicht erreichbare Datenbank. Sobald Neon erreichbar ist und die URLs in Vercel stimmen, verschwinden die Fehler.

# Datenbank: Verbindungsfehler (`db.prisma.io`, P1001)

## Symptome in den Logs

- `PrismaClientInitializationError` / `Can't reach database server at **db.prisma.io:5432**`
- `PrismaClientKnownRequestError` mit Code **`P1001`**
- API-Routen liefern **500** (`/api/user/profile`, `/api/notifications`, …)
- **`POST /api/analytics/beacon` mit 200**, daneben trotzdem **`[auth] DB-Sync-Error`**: Der Beacon kann OK sein, während andere Requests die DB brauchen und fehlschlagen; der JWT-Callback versucht alle ~5 Min. einen DB-Sync — schlägt die DB fehl, wird das geloggt (Session bleibt aus dem Token nutzbar, bis der Sync wieder klappt).

## Was `db.prisma.io` bedeutet

Die Hostname **`db.prisma.io`** steht typischerweise in der **`DATABASE_URL`**, wenn du **Prisma Postgres** (oder einen verwandten Prisma-Datenbankdienst) aus dem **Prisma Data Platform** nutzt. Erreichbarkeit hängt dann von:

1. **Projekt / DB aktiv** im Prisma Cloud Dashboard  
2. **Korrekte URL** in Vercel (kein Tippfehler, kein abgelaufenes Secret in der URL)  
3. **Netzwerk**: selten blockieren Corporate-Firewalls; bei **Vercel** sollte der Outbound-Zugriff normalerweise funktionieren.

## Checkliste (Vercel + Prisma)

1. **Vercel** → Project → **Settings → Environment Variables**  
   - `DATABASE_URL` und **`DIRECT_URL`** (siehe `prisma/schema.prisma`: `directUrl` ist Pflicht)  
   - Werte mit dem aktuellen String aus dem **Prisma Console** / deinem Provider abgleichen.

2. **Prisma Postgres**  
   - In [Prisma Data Platform](https://console.prisma.io) prüfen: Datenbank läuft, keine Pause/Limit.  
   - Connection String **neu kopieren** und in Vercel einsetzen, **Redeploy**.

3. **Statt Prisma-Host: eigener Postgres (Neon, Supabase, Railway, …)**  
   - `DATABASE_URL` = **Pooler-URL** (für Serverless), z. B. mit `?pgbouncer=true&connection_limit=1` wo nötig.  
   - `DIRECT_URL` = **direkte** Postgres-URL (ohne Transaction-Pooler), für Migrationen.  
   - Siehe Kommentare in **`.env.example`**.

4. **Prisma Accelerate** (falls verwendet)  
   - Accelerate nutzt andere URL-Schemata; bitte der **aktuellen Prisma-Doku** folgen. Eine falsche Kombination aus Accelerate-URL und normalem `PrismaClient` führt zu seltsamen Verbindungsfehlern.

5. **Nach Änderung der Env-Vars** immer **neu deployen** (Vercel baut die Serverless-Funktionen mit den neuen Werten).

6. **Richtigen Connection-Typ wählen (häufigster Fehler)**  
   In der Prisma Console gibt es oft **mehrere** Strings (z. B. für Serverless vs. Migrationen):  
   - **`DATABASE_URL` (Vercel / Runtime):** den Eintrag, den Prisma für **„Serverless“ / „Edge“ / Pooling** ausweist — **nicht** blind den ersten „Direct“-String nehmen, wenn die Doku etwas anderes empfiehlt.  
   - **`DIRECT_URL`:** der **direkte** Postgres-Endpunkt für `prisma migrate` (ohne denselben Pooler wie die Runtime-URL, falls unterschiedlich).  
   Wenn Runtime-URL und Direct vertauscht sind, kann `db.prisma.io` von Vercel aus **nicht** erreichbar sein oder Migrationen brechen.

7. **Selbsttest (Admin)**  
   Als Admin eingeloggt: **`GET /api/admin/db-health`** — zeigt anonymisiert Host/Port der konfigurierten URLs und ob `SELECT 1` klappt (`dbOk`).

## Kurzfassung

Der Fehler ist **kein Bug in der App-Logik**, sondern **keine oder keine erreichbare Datenbank** für die konfigurierte `DATABASE_URL`. Sobald Postgres wieder erreichbar ist und die URLs stimmen, verschwinden P1001 / `db.prisma.io`-Fehler und die 500er auf den API-Routen.

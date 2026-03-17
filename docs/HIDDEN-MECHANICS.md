# Hidden Mechanics — Verborgenen Funktionsweisen & Schutzmechanismen

Dieses Dokument beschreibt die **logischen Kernmechanismen** von diaiway, die für Nutzer und viele Entwickler unsichtbar bleiben, aber die Integrität, Sicherheit und UX des Systems garantieren.

---

## 1. Idempotenz-Logik & Race-Condition-Schutz

### Problem

Buchungen sind kritische Transaktionen. Zwei Szenarien gefährden die Integrität:

1. **Netzwerk-Retry**: Der Client sendet `POST /api/bookings`, erhält keine Antwort (Timeout, Verbindungsabbruch) und sendet erneut — ohne Schutz entstehen zwei identische Buchungen.
2. **Race Condition**: Zwei Nutzer buchen denselben Slot gleichzeitig; ohne atomare Prüfung könnte beide erfolgreich sein.

### Double-Layer-Schutz

#### Layer 1: Idempotency Key (Client-Side)

Der Client generiert **einmal pro Buchungsversuch** eine UUID und sendet sie als Header:

```
X-Idempotency-Key: <crypto.randomUUID()>
```

- **Implementierung**: `app/(app)/booking/[id]/page.tsx` — `useState(() => crypto.randomUUID())` beim Mount; derselbe Key wird bei Retries unverändert mitgeschickt.
- **Server-Logik**: `POST /api/bookings` prüft zuerst, ob bereits eine Buchung mit diesem Key für den User existiert (`Booking.idempotencyKey`, `userId`). Bei Treffer: **200** mit `bookingId` der bestehenden Buchung — keine zweite Erstellung.
- **Effekt**: Selbst wenn der Nutzer doppelt tippt oder das Netzwerk dreimal retried, entsteht maximal **eine** Buchung.

#### Layer 2: Serializable Transaction (DB-Side)

Die eigentliche Buchungserstellung läuft in einer **PostgreSQL Serializable Transaction**:

```typescript
prisma.$transaction(async (tx) => {
  const conflict = await tx.booking.findFirst({
    where: {
      expertId, date,
      status: { in: ["pending", "confirmed", "active"] },
      AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
    },
  })
  if (conflict) throw new Error("SLOT_CONFLICT")
  return tx.booking.create({ data: { ... } })
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
```

- **Serializable**: Garantiert, dass keine Phantom-Reads oder Lost Updates auftreten. Zwei parallele Transaktionen, die denselben Slot prüfen, werden serialisiert — eine gewinnt, die andere erhält `SLOT_CONFLICT`.
- **Effekt**: Auch bei Millisekunden-Vorteil eines zweiten Requests (z.B. anderer Nutzer, anderer Slot) verhindert die DB Duplikate auf Slot-Ebene.

### Zusammenfassung

| Bedrohung | Schutz |
|-----------|--------|
| Retry-Loop (gleicher User, gleicher Slot) | Idempotency Key → 200 mit bestehender Buchung |
| Parallele Buchungen (verschiedene User, gleicher Slot) | Serializable Transaction + Conflict-Check |
| Doppel-Tap (gleicher User) | Idempotency Key (Key bleibt pro Formular-Session stabil) |

---

## 2. Real-Time Session Revocation

### Problem: Statische JWTs

JWTs sind **stateless** und **unveränderbar**. Einmal ausgestellt, bleibt der Token bis zur Ablaufzeit gültig. Wenn ein Admin einen Nutzer sperrt, die Rolle entzieht oder das Konto anonymisiert, würde der alte JWT weiterhin Zugriff gewähren — bis zu 24 Stunden (NextAuth `updateAge`).

### Lösung: JWT-to-DB-Validation

Bei **jedem** Request, der `auth()` aufruft, führt der JWT-Callback einen DB-Lookup durch:

```typescript
const dbUser = await prisma.user.findUnique({
  where: { id: userId },
  select: { role: true, appRole: true, status: true, tokenRevocationTime: true },
})
```

#### Revocation Check

```typescript
const tokenIssuedAt = (token.iat as number) ?? 0
if (dbUser.tokenRevocationTime != null && tokenIssuedAt < dbUser.tokenRevocationTime) {
  token.id = undefined
  token.error = "SessionRevoked"
  return token
}
```

- **`token.iat`**: Standard-JWT-Claim „Issued At“ (Unix-Timestamp der Token-Ausstellung).
- **`user.tokenRevocationTime`**: Unix-Timestamp, ab dem alle zuvor ausgestellten Tokens ungültig sind.
- **Logik**: Wenn der Token **vor** der Revokation ausgestellt wurde (`iat < tokenRevocationTime`), gilt er als ungültig. Der Session-Callback setzt `session.user.id = undefined` → `requireAuth()` und Middleware behandeln den Nutzer als ausgeloggt.

#### Wann wird `tokenRevocationTime` gesetzt?

- **Admin PATCH** (`/api/admin/users/[id]`): Bei jeder Änderung von `role`, `appRole`, `status` oder `name` wird `tokenRevocationTime = Math.floor(Date.now() / 1000)` gesetzt.
- **Anonymisierung** (`lib/anonymize-user.ts`): Beim DSGVO-Löschvorgang wird ebenfalls `tokenRevocationTime` gesetzt.

### Effekt

Ein gesperrter, degradierter oder anonymisierter Nutzer verliert den Zugriff **sofort** beim nächsten Request — ohne Relogin, ohne Warten auf Token-Expiry.

---

## 3. Smart Caching & Consistency

### Aktuelle Strategie: ISR + On-Demand Revalidation

Die Takumi-Liste (Kategorien, Suche) wird **hochperformant** ausgeliefert:

- **ISR**: `app/(app)/categories/page.tsx` nutzt `export const revalidate = 3600` — die Seite wird maximal 1 Stunde gecacht.
- **On-Demand**: Nach Profil-Updates rufen `PATCH /api/user/profile` und `PATCH /api/user/takumi-profile` `revalidatePath("/categories")` und `revalidatePath("/takumis")` auf.

### Tag-basierte Revalidation (Empfohlene Erweiterung)

Für präzisere Invalidierung bei Löschungen/Sperren eignet sich ein **Tag-basiertes** Modell:

```typescript
// lib/takumis-server.ts (Beispiel)
import { unstable_cache } from "next/cache"

export const getTakumisForServer = unstable_cache(
  async () => { /* Prisma-Abfrage */ },
  ["takumis-list"],
  { tags: ["takumis"], revalidate: 3600 }
)
```

In allen mutierenden Routen (Admin: User löschen, sperren, Rolle ändern):

```typescript
import { revalidateTag } from "next/cache"
revalidateTag("takumis")
```

- **Vorteil**: Ein einziger Tag invalidiert alle von diesem Tag abhängigen Caches — unabhängig von Pfad oder Seite. Gelöschte/gesperrte Takumis verschwinden sofort im gesamten Edge-Netzwerk.
- **Status**: Aktuell wird `revalidatePath` genutzt; `revalidateTag` kann schrittweise ergänzt werden.

---

## 4. Mobile Resilience Engine — Optimistic UI & Exponential Backoff

### Optimistic UI im Chat

Beim Senden einer Nachricht wird **sofort** ein lokaler Eintrag angezeigt, bevor die API antwortet:

```typescript
const optimisticMsg = {
  id: `temp-${Date.now()}`,
  text, sender: "user", timestamp: Date.now(),
  status: "pending",
  retryCount: 0,
}
setMessages((prev) => [...prev, optimisticMsg])
await sendMessage(payload, tempId, 0)
```

**Zustandsmaschine**:

| Status | Bedeutung |
|--------|-----------|
| `pending` | Wird gesendet oder wartet auf Retry |
| `sent` | Server bestätigt; `id` und `timestamp` vom Server |
| `failed` | Nach 3 Retries fehlgeschlagen; Nutzer kann manuell erneut senden |

### Exponential Backoff

Bei Netzwerkfehlern wird **lautlos** erneut gesendet — ohne Nutzer-Intervention:

```typescript
const delay = 2 ** retries * 1000  // 1s, 2s, 4s
setTimeout(() => sendMessage(payload, tempId, retries + 1), delay)
```

- **Retry 0**: Sofort
- **Retry 1**: 1 Sekunde
- **Retry 2**: 2 Sekunden
- **Retry 3**: 4 Sekunden

Erst nach dem dritten Fehlversuch wechselt die Nachricht zu `failed` und der Nutzer erhält einen Toast. Bis dahin „atmet“ das System temporäre Netzwerkprobleme weg.

---

## 5. Hybrid Auth & RBAC Guard

### Warum nicht rein clientseitige Rollen-Checks?

Clientseitige Checks (z.B. „Zeige Admin-Link nur wenn `user.role === 'admin'`“) sind **kein Sicherheitsmechanismus**. Ein manipulierter Client oder ein alter JWT könnte falsche Rollen behaupten.

### Server-First: `requireAuth()` & `requireAdmin()`

Alle geschützten API-Routen nutzen:

```typescript
const authResult = await requireAuth()
if (authResult.response) return authResult.response
const { session } = authResult
```

- **`requireAuth()`**: Ruft `auth()` auf; bei fehlendem `session.user.id` → **401**.
- **`requireAdmin()`**: Zusätzlich Prüfung `role === "admin"` → sonst **403**.

Die Rollen kommen **nicht** aus dem Client, sondern aus dem JWT, der serverseitig validiert wird.

### Automatische Rollen-Synchronisation

Der JWT-Callback synchronisiert bei jedem Request `role`, `appRole` und `status` aus der Datenbank:

```typescript
token.role = dbUser.role
token.appRole = dbUser.appRole
token.status = dbUser.status
```

- **Effekt**: Wenn ein Admin die Rolle ändert, sieht der nächste Request des betroffenen Nutzers die neue Rolle — ohne Relogin. Gleichzeitig wird bei kritischen Änderungen `tokenRevocationTime` gesetzt, sodass der Nutzer bei Bedarf sofort ausgeloggt wird.

### Anti-Privilege-Escalation

Beim **client-initiierten** Wechsel zu `appRole: "takumi"` (z.B. über Profil-Toggle) prüft der JWT-Callback, ob ein `Expert`-Record existiert:

```typescript
if (updateData.appRole === "takumi") {
  const expert = await prisma.expert.findUnique({ where: { userId } })
  if (expert) token.appRole = "takumi"
  else token.appRole = "shugyo"  // Blockiert
}
```

Ein Nutzer kann sich nicht selbst zum Takumi „befördern“, ohne dass ein Experten-Profil angelegt wurde.

---

## 6. Asset-Performance Pipeline

### Next.js Image Optimization

Alle Takumi-Avatare und Profilbilder werden über `next/image` geladen:

```tsx
<Image
  src={takumi.imageUrl}
  alt={takumi.name}
  fill
  sizes="56px"
  quality={priority ? 85 : 75}
  priority={priority}
/>
```

- **Automatische Optimierung**: Next.js skaliert, komprimiert und liefert moderne Formate (WebP, AVIF) je nach Browser.
- **`sizes`**: Reduziert unnötig große Downloads auf mobilen Geräten.

### LCP-Optimierung mit `priority`

Der **Largest Contentful Paint** (LCP) wird durch `priority={true}` für das erste sichtbare Bild verbessert:

- **Effekt**: Next.js injiziert `<link rel="preload">` für das Bild im `<head>` — der Browser lädt es früher und parallel zum Rest der Seite.
- **Verwendung**: `TakumiCard` und `TakumiCardCompact` erhalten eine `priority`-Prop; der erste Eintrag in Listen/Karussells sollte `priority={true}` erhalten.

### Skeleton-Geometrie für CLS-Vermeidung

`TakumiCardSkeleton` hat die **exakte Geometrie** der echten Karte (Avatar `size-14`, Textzeilen, Abstände). Beim Wechsel von Skeleton zu echtem Inhalt entstehen keine Layout-Shifts (Cumulative Layout Shift = 0).

---

## 7. Session Activity & Inactivity Lockout

### Problem

Eingeloggte Nutzer sollen nach längerer Inaktivität automatisch ausgeloggt werden – aus Sicherheitsgründen (vergessener Bildschirm) und Ressourcenschonung.

### Implementierung

- **Middleware** (`middleware.ts`): Liest `LAST_ACTIVITY_COOKIE`; bei `elapsed >= INACTIVITY_TIMEOUT_SEC` (15 Min) → Cookie und Session-Token löschen, Redirect zu `/login?reason=timeout`
- **SessionActivityProvider** (`components/session-activity-provider.tsx`): Client-seitiger Countdown; Nutzeraktivität (Klicks, Navigation) setzt Timer zurück; 60 Sek vor Ablauf erscheint Warnungs-Modal
- **Heartbeat** (`POST /api/auth/heartbeat`): Während Video-Sessions alle 2 Min aufgerufen; Cookie wird aktualisiert → Session bleibt während Call aktiv
- **lib/session-activity.ts**: `INACTIVITY_TIMEOUT_SEC = 15 * 60`, `INACTIVITY_WARNING_SEC = 60`, `TAKUMI_STALE_OFFLINE_SEC = 5 * 60`

### Takumi-Präsenz-Heartbeat (5-Min-Regel)

Takumis senden über `lib/session-activity.ts` regelmäßige Aktivitäts-Pings. Der Cron `experts-offline` (`app/api/cron/experts-offline/route.ts`) läuft minütlich und setzt alle Takumis auf `liveStatus: "offline"`, deren letzte Aktivität älter als `TAKUMI_STALE_OFFLINE_SEC` (5 Minuten) ist.

```typescript
// lib/session-activity.ts
export const TAKUMI_STALE_OFFLINE_SEC = 5 * 60  // 5 Minuten

// app/api/cron/experts-offline/route.ts
const STALE_MS = TAKUMI_STALE_OFFLINE_SEC * 1000
const staleThreshold = new Date(Date.now() - STALE_MS)
await prisma.expert.updateMany({
  where: {
    liveStatus: "available",
    OR: [{ lastSeenAt: { lt: staleThreshold } }, { lastSeenAt: null }],
  },
  data: { liveStatus: "offline" },
})
```

**Zusammenspiel**: Nutzer-Inaktivity-Timeout (15 Min) und Takumi-Präsenz-Timeout (5 Min) sind bewusst verschieden: Takumis müssen aktiv ansprechbar bleiben; Shugyo-Nutzer haben mehr Spielraum.

### LogoutBackGuard (BFCache-Schutz)

Nach Logout oder Timeout kann der Browser bei **Zurück**-Klick eine gecachte geschützte Seite anzeigen (Back-Forward Cache). Der **LogoutBackGuard** (`components/logout-back-guard.tsx`) fängt das ab:

- **Event**: `pageshow` mit `ev.persisted === true` → Seite kam aus BFCache
- **Aktion**: `fetch /api/auth/session`; bei fehlendem `user` → `window.location.replace("/login")`

Geschützte Pfade: `/dashboard`, `/profile`, `/booking`, `/sessions`, `/session`, `/messages`.

### Cache-Control

Die Middleware setzt für alle geschützten Routen:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

→ Browser speichert keine geschützten Seiten im BFCache; kombiniert mit LogoutBackGuard wird doppelte Absicherung erreicht.

---

## 8. Instant-Call-Abrechnungslogik

### Problem

Instant Calls haben kein festes Preismodell im Voraus – der Nutzer weiß beim Anruf noch nicht, wie lang er spricht. Gleichzeitig soll ein **Erstgespräch** großzügiger behandelt werden als Folgegespräche.

### Lösung: hasPaidBefore-Logik

Nach Session-Ende (`PATCH /api/bookings/[id]`, `action: end-session`) wird die Wallet-Abrechnung ausgelöst:

```typescript
const hasPaidBefore = !!(await prisma.booking.findFirst({
  where: {
    userId: booking.userId,
    expertId: booking.expertId,
    paymentStatus: "paid",
    id: { not: id },
  },
}))
await chargeInstantCallToWallet(id, duration, pricePerMinuteCents, hasPaidBefore)
```

In `lib/wallet-service.ts`:

```typescript
const FREE_MIN = hasPaidBefore ? 0.5 : 5  // 30 Sek oder 5 Min gratis
const billingMin = Math.max(0, durationMin - FREE_MIN)
const amountCents = Math.round(billingMin * pricePerMinuteCents)
```

| Kontakt | Kostenlose Phase | Begründung |
|---------|-----------------|------------|
| **Erstkontakt** (`hasPaidBefore = false`) | 5 Minuten | Kennenlernen ohne Risiko |
| **Zweitkontakt+** (`hasPaidBefore = true`) | 30 Sekunden | Kurzer Puffer, danach volle Abrechnung |

### UI-Synchronisation

`DailyCallContainer.tsx` (`calculateRemainingTime`) spiegelt exakt dieselbe Logik wider:

```typescript
const freePeriodSec = hasPaidBefore ? 30 : 5 * 60
```

Der Countdown im Call zeigt dem Nutzer korrekt an, ab wann Kosten entstehen.

### Idempotenz bei Instant-Call-Abrechnung

`chargeInstantCallToWallet` läuft innerhalb einer `prisma.$transaction`. Bereits abgerechnete Bookings (`paymentStatus: "paid"`) werden übersprungen – mehrfache Aufrufe (z. B. durch Retry bei Netzwerkfehler) sind sicher:

```typescript
// lib/wallet-service.ts
const existing = await tx.booking.findUnique({ where: { id: bookingId }, select: { paymentStatus: true } })
if (existing?.paymentStatus === "paid") return { ok: true }  // Idempotenz-Guard
```

### Abgrenzung zu Scheduled Sessions

| Feature | Scheduled | Instant |
|---------|-----------|---------|
| Vorauszahlung | ✅ Stripe oder Wallet | ❌ (Wallet post-session) |
| Kostenlose Phase | 5 Min (fix) | 5 Min Erstkontakt / 30 Sek Folge |
| Abrechnung | Capture via Cron/Event | `chargeInstantCallToWallet` bei end-session |
| Idempotenz | `paymentStatus`-Guard | `paymentStatus`-Guard in `$transaction` |

---

## 9. Safety-Incident-Terminierung (Live-Monitoring)

### Problem

Wenn Google Vision während eines laufenden Video-Calls einen Verstoß erkennt (LIKELY/VERY_LIKELY bei adult, violence, racy), muss die Verbindung **sofort** getrennt werden – nicht erst nach dem Call.

### Implementierung

`POST /api/safety/snapshot` wird bei jedem Snapshot (5s, 30s, 60s, 90s, 120s) aufgerufen. Bei Verstoß:

1. Blob speichern, `SafetyIncident` erstellen, `setTransactionOnHoldForBooking`
2. Response: `{ ok: true, safe: false, incidentCreated: true }`

**Client** (`DailyCallContainer.tsx`):

```typescript
if (data?.incidentCreated) {
  toast.error("Verbindung getrennt: Verstoß gegen die Community-Richtlinien erkannt.")
  performCleanup()
  if (onCallEnded) onCallEnded()
  else redirectToSessions("safety-violation")
}
```

- **performCleanup()**: Daily-Call verlassen, Ressourcen freigeben
- **onCallEnded()**: Parent-Callback für Post-Call-UI
- **redirectToSessions()**: Fallback-Redirect zu Sessions-Liste

### Effekt

Der Nutzer sieht sofort einen Toast und wird aus dem Call geworfen. Der Incident ist in der DB und unter `/admin/safety/incidents` sichtbar.

---

## 10. DB-Resilienz im Auth-Flow

### Problem

Bei Datenbank-Aussetzern (P1001, Cold Start) schlägt `prisma.user.findUnique()` in `authorize` fehl. NextAuth meldet dann typisch „CredentialsSignin“ → Login-Seite zeigt „E-Mail oder Passwort ist falsch“, obwohl die Credentials korrekt sind.

### Lösung

- **authorize**: `try/catch` um DB-Operationen; bei Fehler → `throw new Error("DB_ERROR")`
- **Login-Seite**: Prüft `result.error.includes("DB_ERROR")` → zeigt `t("login.errorNetwork")` („Verbindungsfehler. Bitte erneut versuchen.“) statt „falsches Passwort“
- **JWT-Callback**: DB-Sync (Rollen, Revocation) nur alle 5 Min (`DB_SYNC_INTERVAL_SEC`) → reduziert DB-Last bei vielen Requests

---

## 11. Übersicht: Wo was lebt

| Mechanismus | Datei(en) |
|-------------|-----------|
| Idempotency Key (Client) | `app/(app)/booking/[id]/page.tsx` |
| Idempotency Check + Serializable Tx | `app/api/bookings/route.ts` |
| Session Revocation (JWT-Callback) | `lib/auth.ts` |
| tokenRevocationTime setzen | `app/api/admin/users/[id]/route.ts`, `lib/anonymize-user.ts` |
| requireAuth / requireAdmin | `lib/api-auth.ts` |
| Optimistic UI + Exponential Backoff | `components/user-chat-box.tsx` |
| ISR + revalidatePath | `app/(app)/categories/page.tsx`, `app/api/user/profile/route.ts`, `app/api/user/takumi-profile/route.ts` |
| Image priority, Skeleton | `components/takumi-card.tsx`, `components/takumi-card-skeleton.tsx` |
| Session Activity, Inactivity | `lib/session-activity.ts`, `components/session-activity-provider.tsx`, `components/session-timeout-warning.tsx`, `middleware.ts` |
| Takumi-Präsenz (5-Min-Heartbeat) | `lib/session-activity.ts` (`TAKUMI_STALE_OFFLINE_SEC`), `app/api/cron/experts-offline/route.ts` |
| LogoutBackGuard | `components/logout-back-guard.tsx` |
| Cache-Control (geschützte Routen) | `middleware.ts` |
| DB_ERROR Handling | `lib/auth.ts` (authorize), `app/login/page.tsx` |
| Instant-Abrechnung (hasPaidBefore) | `lib/wallet-service.ts`, `app/api/bookings/[id]/route.ts`, `components/video-call/DailyCallContainer.tsx` |
| Instant-Abrechnung Idempotenz | `lib/wallet-service.ts` (paymentStatus-Guard in `$transaction`) |
| Video-Safety PRE_CHECK Gate | `app/api/safety/pre-check/route.ts`, `components/video-call/DailyCallContainer.tsx` |
| Video-Safety Blitzlicht-Protokoll | `components/video-call/DailyCallContainer.tsx` (SNAPSHOT_DELAYS_MS, Hard-Stop 120s) |
| Video-Safety Incident-Terminierung | `DailyCallContainer.tsx` – bei `incidentCreated` → `performCleanup()`, `onCallEnded()`, Toast, Redirect |
| DSGVO Cleanup (Safety-Blobs) | `app/api/cron/cleanup-safety-data/route.ts` |
| WalletTransaction-Anonymisierung | `lib/anonymize-user.ts` (referenceId → null, metadata → null) |

---

## 12. Umgebungsvariablen (Platzhalter)

Keine echten Keys in dieser Dokumentation. Relevante Platzhalter:

| Variable | Verwendung |
|----------|------------|
| `DATABASE_URL` | Prisma, PostgreSQL |
| `NEXTAUTH_SECRET` | JWT-Signatur |
| `NEXTAUTH_URL` | Auth-Redirects, E-Mail-Links |
| `STRIPE_*` | Zahlungen |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (Bilder) |

Details: [docs/ENV.md](./ENV.md)

---

*Letzte Aktualisierung: März 2026*

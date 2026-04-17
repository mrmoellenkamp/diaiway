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

### Sessions-Tab-Triage & Expiry-Guard

In `/sessions` werden Buchungen nicht nur nach DB-Status, sondern auch nach Terminzeit einsortiert:

- **Aktiv**: nur `status = active`
- **Geplant**: `pending` oder `confirmed` **und** Termin ist noch nicht abgelaufen
- **Fertig**: `completed`, `declined`, `cancelled` sowie automatisch alle `pending/confirmed`, deren Endzeit bereits in der Vergangenheit liegt

Damit bleiben alte, nie gestartete Termine nicht dauerhaft in „Geplant“ hängen.

Zusätzlich blockiert der Start-Flow abgelaufene Termine serverseitig:

- `POST /api/daily/meeting` prüft `booking.date + booking.endTime` (Europe/Berlin)
- Bei abgelaufenem `pending/confirmed` Termin: **409** mit Fehlermeldung
- Die Session-Seite zeigt in diesem Fall einen Fallback und führt zurück zur Sessions-Liste

Housekeeping für Datenkonsistenz:

- Beim Laden von `/api/bookings`, `/api/admin/bookings` und `/api/admin/stats` läuft ein Auto-Cleanup.
- Abgelaufene **scheduled** Buchungen mit `status in (pending, confirmed)` und `paymentStatus in (unpaid, failed)` werden automatisch auf `cancelled` gesetzt.
- Scope ist bewusst konservativ: Bereits bezahlte Buchungen werden nicht stillschweigend umgebucht, damit keine Finanzlogik umgangen wird.

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

## 8. Abrechnungslogik aller Call-Typen

### Drei Call-Typen mit unterschiedlichen Regeln

Das System kennt drei Call-Typen mit eigenen Handshake- und Abrechnungsregeln:

---

#### 1. Geplanter/Gebuchter Call (scheduled)

Zahlung erfolgt per **Stripe-Deposit vorab** (Hold & Capture).

| Kontakt | Handshake-Grenze | Verhalten bei Abbruch | Verhalten bei längerer Dauer |
|---------|-----------------|----------------------|------------------------------|
| **Erstkontakt** | 300 Sek (5 Min) | Deposit wird storniert/zurückgebucht, kein Geld | Volle Dauer wird abgerechnet |
| **Folgekontakt** | 30 Sek | Deposit wird storniert/zurückgebucht, kein Geld | Volle Dauer wird abgerechnet |

- **Abrechnung:** Viertelstunden-genau (auf die nächste volle 15 Min aufgerundet)
- **Abrechnungsbasis:** Gebuchter Festpreis (nicht minutengenau)
- **Capture:** via `processCompletion()` nach 24h oder bei manueller Freigabe

```typescript
// Handshake-Schwelle in end-session (app/api/bookings/[id]/route.ts)
const handshakeSec = hasPaidBeforeScheduled ? 30 : 300
const isFreeSession = durationSec < handshakeSec
// Viertelstunden-Rundung:
const duration = Math.ceil(durationMinRaw / 15) * 15
```

---

#### 2. Instant Call

Zahlung erfolgt **post-session** aus dem Wallet (kein Vorab-Hold).

| Kontakt | Handshake-Grenze | Verhalten bei Abbruch | Verhalten bei längerer Dauer |
|---------|-----------------|----------------------|------------------------------|
| **Erstkontakt** | 60 Sek | Kein Wallet-Abzug | Volle Dauer, mind. 5 Min |
| **Folgekontakt** | 60 Sek | Kein Wallet-Abzug | Volle Dauer, mind. 5 Min |

- **Abrechnung:** Minutengenau, Mindestabrechnung 5 Minuten
- **Abrechnungsbasis:** Preis/Min des Takumi × abgerechnete Minuten

```typescript
// lib/wallet-service.ts
const HANDSHAKE_MIN = 1         // 60 Sek
const MIN_BILLING_MIN = 5       // Mindestabrechnung

if (durationMin < HANDSHAKE_MIN) return { ok: true, amountCents: 0 }
const billingMin = Math.max(durationMin, MIN_BILLING_MIN)
const amountCents = Math.round(billingMin * pricePerMinuteCents)
```

---

#### 3. Guest Call

Zahlung erfolgt per **Stripe Einmalzahlung** direkt vor dem Call (Festpreis).

| Handshake-Grenze | Verhalten bei Abbruch | Verhalten bei längerer Dauer |
|-----------------|----------------------|------------------------------|
| 60 Sek | Stripe-Storno / Refund | Voller Festpreis, Viertelstunden-genau |

- **Abrechnung:** Festpreis (beim Anlegen der Einladung fixiert)
- Der 60-Sek-Handshake wird in `end-session` und `session-terminate.ts` geprüft

---

### Wo die Logik lebt – Übersicht

| Schicht | Datei | Zuständig für |
|---------|-------|---------------|
| Handshake + Freigabe (Server) | `app/api/bookings/[id]/route.ts` → `end-session` | Alle Call-Typen: Handshake-Check, hasPaidBefore, Viertelstunden-Rundung |
| Instant Wallet-Abrechnung | `lib/wallet-service.ts` → `chargeInstantCallToWallet()` | 60-Sek-Schwelle, Mindest-5-Min, volle Dauer |
| Cron/Freeze-Terminierung | `lib/session-terminate.ts` | Dynamische Handshake-Grenze (30/60/300 Sek je Typ) |
| Client-Timer (Anzeige) | `components/video-call/DailyCallContainer.tsx` | Timer läuft ab Sekunde 1, Wallet-Restzeit-Anzeige |

---

### Dynamische Handshake-Grenze (session-terminate.ts)

```typescript
const handshakeSec = isInstant || isGuestCall
  ? 60                              // Instant + Guest
  : hasPaidBefore ? 30 : 300        // Geplant: Folge / Erst
```

### Client-Timer

`DailyCallContainer.tsx` zeigt den Countdown **ab Sekunde 1** (keine Freizeit-Verzögerung mehr im Client). Die Handshake-Grenze ist ausschließlich eine **serverseitige no-charge-Grenze**.

### Idempotenz bei Instant-Call-Abrechnung

`chargeInstantCallToWallet` läuft innerhalb einer `prisma.$transaction`. Bereits abgerechnete Bookings (`paymentStatus: "paid"`) werden übersprungen:

```typescript
if (booking.paymentStatus === "paid") return { ok: true, amountCents }
```

### Vergleich aller drei Call-Typen

| Feature | Geplant | Instant | Guest |
|---------|---------|---------|-------|
| Zahlung | Vorab (Hold) | Post-Session (Wallet) | Vorab (Stripe Einmal) |
| Handshake Erstkontakt | 300 Sek | 60 Sek | 60 Sek |
| Handshake Folgekontakt | 30 Sek | 60 Sek | – |
| Abrechnung | Viertelstunden-genau | Minutengenau, mind. 5 Min | Festpreis |
| Capture | Cron / manuelle Freigabe | Sofort bei end-session | Stripe direkt |

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

### Gast-Calls (`/call/[guestToken]`)

- **Endpoint:** `POST /api/guest/snapshot` – kein NextAuth; `guestToken` + `imageBase64`. Rate-Limit nach IP (`lib/rate-limit.ts`).
- **Client:** `GuestVideoCall` in `app/call/[guestToken]/page.tsx` plant dieselben Abstände **5 / 30 / 60 / 90 / 120 s** nach Join.
- **Bei Verstoß:** wie oben Blob + `SafetyIncident`; zusätzlich `moderationViolationAt` am **Experten**-User (Gast oft ohne `User`-Zeile). Kein `setTransactionOnHoldForBooking` in diesem Pfad (Gast-Escrow anders modelliert).
- **Response:** `incidentCreated: true` → Client beendet den Call (`onLeave`).

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
| Abrechnungslogik alle Call-Typen | `lib/wallet-service.ts`, `app/api/bookings/[id]/route.ts`, `lib/session-terminate.ts`, `components/video-call/DailyCallContainer.tsx` |
| Instant-Abrechnung Idempotenz | `lib/wallet-service.ts` (paymentStatus-Guard in `$transaction`) |
| Video-Safety PRE_CHECK Gate | `app/api/safety/pre-check/route.ts`, `components/video-call/DailyCallContainer.tsx` |
| Video-Safety Blitzlicht-Protokoll | `components/video-call/DailyCallContainer.tsx` (SNAPSHOT_DELAYS_MS, Hard-Stop 120s) |
| Gast-Call Blitzlicht | `app/call/[guestToken]/page.tsx` (`GuestVideoCall` → `/api/guest/snapshot`) |
| Video-Safety Incident-Terminierung | `DailyCallContainer.tsx` – bei `incidentCreated` → `performCleanup()`, `onCallEnded()`, Toast, Redirect |
| DSGVO Cleanup (Safety-Blobs) | `app/api/cron/cleanup-safety-data/route.ts` |
| WalletTransaction-Anonymisierung | `lib/anonymize-user.ts` (referenceId → null, metadata → null) |
| Admin-Stats degraded (200) | `app/api/admin/stats/route.ts` → `emptyStatsPayload` |
| Site-Analytics Beacon | `app/api/analytics/beacon/route.ts`, `components/site-analytics-tracker.tsx` |
| Mobile `out/` Redirect | `scripts/prepare-mobile-webdir.mjs` |
| API-Rate-Limiting (User + IP) | `lib/api-rate-limit.ts`, `lib/rate-limit.ts` (Upstash + In-Memory-Fallback) |
| CSP-Nonce + `strict-dynamic` | `middleware.ts` (Header `x-nonce`) |
| Signierte Blob-Proxy-URLs | `lib/signed-url.ts`, `app/api/files/signed/route.ts`, `app/api/files/secure-upload/route.ts` |
| Gast-Checkout-Store (Upstash TTL) | `lib/guest-checkout-store.ts`, `app/api/guest/checkout/route.ts`, `app/api/webhooks/stripe/route.ts` |
| Secret-Redaktion in Logs | `lib/log-redact.ts` (`logSecureError`, `logSecureWarn`) |
| Timing-safe Secret-Vergleiche | `lib/timing-safe.ts`, `lib/cron-auth.ts`, `app/api/auth/seed-admin/route.ts`, `app/api/webhooks/daily/route.ts` |
| Zod-Schemas (Input-Validierung) | `lib/schemas/{common,bookings,profile,messages,upload}.ts` |
| Serverseitige Preisberechnung | `app/api/bookings/route.ts` (ignoriert Client-`totalPrice`/`price`) |
| Magic-Byte-Prüfung beim Upload | `app/api/upload/route.ts` (`sharp().metadata()`) |

---

## 12. Admin-Statistik-API: HTTP 200 bei Fehler („degraded“)

### Verhalten

`GET /api/admin/stats` führt viele Prisma-Aggregationen aus. Schlägt die Datenbank fehl (z. B. P1001 „Can’t reach database“) oder ein anderes technisches Problem auf, wird **kein** HTTP 5xx zurückgegeben, sondern:

- **Status 200**
- JSON mit `degraded: true` und `degradedReason` (nutzerlesbare Kurzmeldung)

### Warum

- Die Admin-UI bleibt **bedienbar** (leere KPIs statt kompletter Fehlerseite).
- **Nachteil fürs Monitoring:** Reine HTTP-Status-Checks sehen „alles grün“, obwohl keine echten Daten geladen wurden — Logs oder Response-Body prüfen (`[admin/stats] Aggregation fehlgeschlagen` in Server-Logs).

### Verwandt

- `GET /api/admin/analytics` liefert bei fehlenden Tabellen ebenfalls ein **degraded**-Payload mit Hinweis auf Migration.

---

## 13. Site-Analytics (eigene Verkehrsstatistik)

### Zweck

Erfassung **anonymer** Nutzung: Sitzungen, Pfade, ungefähre Verweildauer (Tab sichtbar), **ohne** IP-Speicherung in diesen Tabellen.

### Ablauf

1. **`SiteAnalyticsTracker`** (`components/site-analytics-tracker.tsx`) im Root-`layout.tsx` — läuft nur im Client.
2. **Kein Tracking** für Pfade, die mit `/admin` oder `/api` beginnen (`shouldTrackPath`).
3. **`POST /api/analytics/beacon`**: Aktionen `init` (neue Session + erste PageView), `page` (Navigation + Dauer der vorherigen Seite), `pulse` (alle ~20 s bei sichtbarem Tab, erhöht `engagedSeconds`).
4. **Besucher-ID**: UUID in `localStorage` (`diaiway_analytics_vid`); Sitzungs-ID in `sessionStorage` (`diaiway_analytics_sid`).
5. **Eingeloggte Nutzer**: Server kann `userId` an die Session hängen (für Anteil „Sitzungen mit Login“).
6. **Bots**: grobe Filterung per User-Agent in `lib/site-analytics.ts`.

### Datenmodell

- `SiteAnalyticsSession`, `SiteAnalyticsPageView` (Prisma) — Migration `20260321140000_site_analytics`.

### Admin

- Tab **Statistik** / Query `GET /api/admin/analytics?days=7|14|30|90`.

---

## 14. Capacitor: minimales `out/` + `server.url`

### Problem

Capacitor verlangt ein `webDir` mit Dateien; die App lädt aber die **Live-URL** (`capacitor.config.ts` → `server.url: https://diaiway.com`).

### Lösung

`scripts/prepare-mobile-webdir.mjs` erzeugt ein minimales `out/index.html` (Redirect zur Live-URL) und `out/error.html`. `npm run mobile:sync` ruft das vor `cap sync` auf.

### Basis-URL für Redirect

Priorität: `NEXTAUTH_URL` → `VERCEL_URL` → Fallback `https://diaiway.com` — damit lokale/staging-Builds nicht versehentlich immer Produktion laden, wenn die Env gesetzt ist.

---

## 15. Umgebungsvariablen (Platzhalter) — Kurz

Keine echten Keys in dieser Dokumentation. Relevante Platzhalter:

| Variable | Verwendung |
|----------|------------|
| `DATABASE_URL` | Prisma, PostgreSQL |
| `NEXTAUTH_SECRET` | JWT-Signatur, Fallback für `FILE_SIGNING_SECRET` |
| `NEXTAUTH_URL` | Auth-Redirects, E-Mail-Links |
| `STRIPE_*` | Zahlungen |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (Bilder, Dokumente) |
| `FILE_SIGNING_SECRET` | HMAC-Key für signierte Blob-Proxy-URLs (Rotation invalidiert Alt-Links) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate-Limits + Gast-Checkout-Store |
| `CRON_SECRET`, `DAILY_GHOST_SECRET` | Timing-safer Schutz der Cron-Routen |

Details: [docs/ENV.md](./ENV.md) · Policy: [SECURITY.md](../SECURITY.md)

---

## 16. Buchungs-Benachrichtigungsfluss

### Ablauf (vollständig)

| Ereignis | Empfänger | Kanal |
|---|---|---|
| Buchung bezahlt | Takumi | E-Mail (Accept/Decline-Links) + In-App + Push |
| Instant-Anfrage (`POST /api/bookings/instant`) | Takumi | In-App + E-Mail (`sendBookingRequestEmail`) + Push (`pushType: BOOKING_REQUEST`) |
| Takumi bestätigt / lehnt ab (Dashboard **oder** E-Mail-Link `GET/PATCH /api/bookings/[id]/status`) | Shugyo | E-Mail + In-App + Push (`BOOKING_UPDATE`); alte `booking_request`-Notifications beim Takumi werden bereinigt |
| Takumi stellt Rückfrage | Shugyo | E-Mail + In-App + Push |
| Buchung storniert (von Shugyo) | Takumi | E-Mail + In-App + Push |
| Buchung storniert (von Takumi) | Shugyo | E-Mail + In-App + Push |
| Session abgeschlossen (`processCompletion`) | Shugyo | In-App + Push (Session completed) |
| Zahlung fehlgeschlagen (Stripe Webhook) | Shugyo | In-App + Push (`PAYMENT`) |
| Wallet-Aufladung erfolgreich (Webhook) | Nutzer | In-App + Push (`PAYMENT`) |
| 30 Min vor Session | Shugyo + Takumi | Lokale Geräteerinnerung (Capacitor, nur Native-App) |

### Implementierung

- **`lib/notification-service.ts`**: `notifyAfterPayment()` (Buchung bezahlt → Takumi), `notifyAfterCancellation()` (Stornierung → andere Partei)
- **`app/api/booking-respond/[id]/route.ts`**: Bestätigung/Ablehnung/Rückfrage → Shugyo-Benachrichtigung
- **`app/(app)/sessions/page.tsx`**: Lokale Erinnerungen via Capacitor Local Notifications
- **`lib/push.ts` / `lib/push-fcm.ts`**: Payload-Feld **`pushType`** → natives Routing (Android `channelId`, iOS `aps.category`)
- **`lib/system-waymail.ts`**: System-Waymails erzeugen **keine** zusätzlichen In-App-Notifications/Pushes mehr (vermeidet Doppelungen); der aufrufende Code ist dafür zuständig

### Wichtig: `deferNotification`

Der Buchungsflow setzt immer `deferNotification: true` — Takumi-Benachrichtigungen werden erst **nach erfolgreicher Zahlung** via `POST /api/bookings/[id]/notify-takumi` ausgelöst. Ohne Zahlung: kein Spam beim Takumi.

---

---

## 17. Security-Layer (Rate-Limits, CSP, signierte Blobs, Log-Redaktion)

Die vollständige Security-Policy steht in [`SECURITY.md`](../SECURITY.md). Dieser Abschnitt erklärt die *verborgenen* Mechanismen, die im Code leben und für Entwickler:innen relevant sind.

### 17.1 Zentrales Rate-Limiting (`lib/api-rate-limit.ts`)

Jede Mutations- oder scrapinggefährdete API nutzt den Helper `assertRateLimit({ req, userId }, { bucket, limit, windowSec })`. Er limitiert **gleichzeitig**:

- pro `userId` (verhindert, dass ein kompromittierter Account per IP-Hopping unbegrenzt requestet)
- pro IP (`getClientIp`, Fallback auf `unknown`)

Storage: **Upstash Redis** (global, instanzübergreifend). Fehlt die Konfiguration, fällt der Helper transparent auf einen In-Memory-Sliding-Window-Zähler zurück.

Bei Überschreitung wird direkt `NextResponse.json({ error }, { status: 429, headers: { "Retry-After": ... } })` zurückgegeben – der Aufrufer muss nur `if (rl) return rl` schreiben.

**Konvention für neue Routen:** Jeder `POST`/`PATCH`/`DELETE` bekommt einen Bucket-Namen (`"bookings:create"`, `"messages:send"`, …). Aktuelle Limits siehe `SECURITY.md` Abschnitt 4.6.

### 17.2 CSP mit Nonce und `strict-dynamic`

`middleware.ts` erzeugt pro Request einen 16-Byte-Nonce (base64) und hängt ihn an:

- Response-Header `x-nonce` (damit `app/layout.tsx` den Nonce bei `<Script>`-Tags setzen kann)
- `Content-Security-Policy`-Header mit `'nonce-<…>'` und `'strict-dynamic'` für `script-src` / `script-src-elem`

`'unsafe-eval'` ist entfernt. `'unsafe-inline'` bleibt als Legacy-Fallback im Header – moderne Browser ignorieren es dank `'strict-dynamic'`. Außerdem setzt die Middleware explizit `X-XSS-Protection: 0`, weil der Header in älteren Browsern neue Reflection-Vektoren öffnen kann.

### 17.3 Signierte Proxy-URLs für private Blobs (`lib/signed-url.ts`)

Sensible Dokumente (Ausweise, Safety-Reports) sollen nicht über permanente `blob.vercel-storage.com`-URLs erreichbar sein – ein einmaliger Leak im Log oder Waymail-Forward wäre dauerhaft.

- `signBlobProxyUrl(blobUrl, { ownerUserId, ttlSec })` liefert eine URL der Form  
  `/api/files/signed?u=<base64url>&e=<expiry>&uid=<ownerUserId>&s=<hmac>`  
- `verifyBlobProxyParams` (in `/api/files/signed/route.ts`) prüft:
  1. HMAC mit `FILE_SIGNING_SECRET` (Fallback `NEXTAUTH_SECRET`) – konstante Zeit.
  2. Ablaufzeit (`e > now`).
  3. Owner (`uid` muss zum eingeloggten Nutzer passen, sofern gesetzt).
  4. Zielhost muss eine Vercel-Blob-Domain sein (kein offener Redirect).
- Bei Erfolg: `302` zum echten Blob. Sonst: `403` + `logSecureWarn`.

Clients bekommen von `POST /api/files/secure-upload` statt der rohen Blob-URL ein `signedUrl`- und `thumbnailSignedUrl`-Feld (TTL 1 h, gebunden an `session.user.id`). Rotation von `FILE_SIGNING_SECRET` entzieht alle Alt-Links.

### 17.4 Gast-Checkout-Store (`lib/guest-checkout-store.ts`)

Gast-Call-Checkouts können ein temporäres Passwort und Rechnungsdaten tragen, die nach Zahlung einen echten Account erzeugen. Diese sensiblen Felder werden **nicht** in `booking.note` geschrieben, sondern via Upstash Redis in einem Schlüssel `guest:checkout:<bookingId>` mit kurzer TTL abgelegt.

- **Zugriffsprimitiven:** `putGuestCheckoutData`, `takeGuestCheckoutData` (atomar: lesen + löschen), `peekGuestCheckoutData`, `deleteGuestCheckoutData`.
- Der Stripe-Webhook (`app/api/webhooks/stripe/route.ts` → `handleGuestCallPayment`) holt die Daten **ausschließlich** per `takeGuestCheckoutData`. Dadurch sind die Secrets nach Account-Anlage weder in der DB noch in Redis.
- Fallback, wenn Upstash nicht konfiguriert ist: In-Memory-Map (nur lokal/Dev sinnvoll).

### 17.5 Secret-Redaktion beim Logging (`lib/log-redact.ts`)

Statt `console.error(err)` benutzen alle Routen `logSecureError(context, err, extra?)` und `logSecureWarn(context, message, extra?)`. Die Funktion:

- serialisiert den Fehler (inkl. Stack),
- maskiert DB-Connection-Strings, `Bearer …`-Tokens, `sk_live_…`/`whsec_…`-Secrets, JWTs und `password=…`-Parameter per Regex,
- kürzt sehr lange Strings.

Dadurch erscheinen in Vercel-Logs nie echte Secrets – auch nicht, wenn Prisma-Fehler die komplette `DATABASE_URL` enthalten würden.

### 17.6 Timing-safe Secret-Vergleiche (`lib/timing-safe.ts`)

Überall, wo ein serverseitiger String-Secret-Check stattfindet, wird `safeBearerCompare` / `safeStringCompare` verwendet (intern `crypto.timingSafeEqual` mit Längen-Guard):

- **Cron-Authz** (`assertCronAuthorized`) für `Authorization: Bearer <CRON_SECRET>` (und Alt-ENV wie `DAILY_GHOST_SECRET`)
- **Admin-Seed** (`app/api/auth/seed-admin/route.ts`) – `ADMIN_PASSWORD`
- **Daily-Webhook** (`app/api/webhooks/daily/route.ts`) – HMAC, mit explizitem `Buffer`-Längen-Check, damit `crypto.timingSafeEqual` keinen `TypeError` wirft

### 17.7 Upload-Härtung (`POST /api/upload`)

- **Magic-Byte-Prüfung** via `sharp().metadata()`. Der vom Client geschickte `file.type` wird *nicht* vertraut – eine `.exe`, die sich als `image/png` ausgibt, scheitert am echten Header.
- **Zielordner** nur aus `uploadFolderSchema`-Allowlist.
- **Rate-Limit** 40 / Stunde pro User+IP.
- Bild-Optimierung (EXIF-Strip, max. 2048 px, JPEG) bleibt zusätzlich aktiv.

### 17.8 Serverseitige Preise (`POST /api/bookings`)

Der Client schickt `totalPrice`/`price` nicht (bzw. seine Werte werden ignoriert). Die Route liest `expert.priceVideo15Min` / `priceVoice15Min` bzw. `pricePerSession` und berechnet den Preis aus der tatsächlichen Slot-Dauer (Vielfache von 15 min). Damit kann DevTools-Manipulation keine Rabatt-Requests erzwingen.

### 17.9 Zod-Schemas zentral (`lib/schemas/`)

Input-Validierung lebt in `lib/schemas/`:

- `common.ts` – `imageUrlSchema` (Allowlist Vercel-Blob + signierte Proxy-URLs), `cuidSchema`, `isoDateSchema`, `hhmmSchema`.
- `bookings.ts`, `profile.ts`, `messages.ts`, `upload.ts` – pro Endpoint.

Alle Mutations-Routen parsen `req.json()` mit diesen Schemas. `ZodError` wird im `apiHandler` zu 400 mit lokalisierter Meldung.

---

*Letzte Aktualisierung: April 2026 – Security-Layer (Rate-Limits, CSP-Nonce, signierte Blob-URLs, Guest-Checkout-Store, Log-Redaktion, Magic-Bytes). Benachrichtigungen (Instant, Status-Links, Session, Zahlung, Wallet-Topup, pushType, Waymail-Dedup); Abrechnungs- und Belegdoku: [BILLING-DOCUMENTS-AND-PAYMENTS.md](./BILLING-DOCUMENTS-AND-PAYMENTS.md)*

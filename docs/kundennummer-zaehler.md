# Belegnummern, Kundennummer und `InvoiceCounter`

**Stand:** März 2026  

Zentrale Referenz für alle **fortlaufenden Nummern** aus `lib/billing.ts` → Tabelle **`InvoiceCounter`** (Prisma). Vollständiger fachlicher Kontext: [BILLING-DOCUMENTS-AND-PAYMENTS.md](./BILLING-DOCUMENTS-AND-PAYMENTS.md).

---

## Wo liegt das?

Tabelle **`InvoiceCounter`**, Spalte **`type`** (eindeutiger String), Spalte **`value`** = **ganze Zahl** (PostgreSQL `integer`).

Erlaubte `type`-Werte im Code (`DocType` in `lib/billing.ts`): **`RE`**, **`GS`**, **`SR`**, **`SG`**, **`PR`**, **`GBL`**, **`KD`**.

---

## Anzeigeformate (nach Vergabe)

| `type` | Format im PDF / UI | Bedeutung |
|--------|-------------------|-----------|
| `KD` | `KD-00001` (5-stellig, `padStart`) | Einmalige Kundennummer pro User |
| `RE` | `RE-100001` … | Rechnung Shugyo (Session) |
| `GS` | `GS-100001` … | Gutschrift Takumi |
| `PR` | `PR-100001` … | Provisionsrechnung Plattform → Takumi |
| `SR` | `SR-100001` … | Storno-Rechnung |
| `SG` | `SG-100001` … | Storno-Gutschrift |
| `GBL` | `GBL-100001` … | Guthabenbeleg (Wallet-Aufladung) |

Startwerte beim ersten Anlegen eines Zählers: `INITIAL_VALUES` in `lib/billing.ts`.

---

## Kundennummer: Nächste Vergabe soll `KD-00001` sein

Der Zähler arbeitet so:

- Gibt es **noch keinen** Eintrag `KD`, legt die App beim ersten Aufruf einen an und vergibt **1** → **KD-00001**.
- Gibt es **schon** einen Eintrag, wird **`value` um 1 erhöht** und dieser neue Wert vergeben.

`value` entspricht damit der **zuletzt vergebenen** Nummer (nach der ersten Vergabe).  
Damit die **nächste** Vergabe wieder **1** ist, muss vor dem nächsten Aufruf gelten: Hochzählen von **0 → 1**.

### SQL (manuell in der DB ausführen)

**Nur** wenn keine Kollision mit bestehenden `User.customerNumber` entsteht (z. B. Dev/Test oder du weißt, dass noch keine KD-Nummern existieren):

```sql
-- Nächste Kundennummer wird KD-00001
UPDATE "InvoiceCounter" SET "value" = 0 WHERE "type" = 'KD';
```

**Nicht** `value = 1` setzen, wenn die **nächste** Nummer 00001 sein soll — dann würde der nächste Aufruf auf **2** hochzählen → **KD-00002**.

### Zeile fehlt komplett

Dann reicht der nächste reguläre Ablauf in der App (ohne SQL): Es wird ein neuer Eintrag mit Startwert **1** angelegt → **KD-00001**.

Optional Zeile anlegen (z. B. für Übersicht in Prisma Studio), damit der nächste Lauf **1** vergibt:

```sql
INSERT INTO "InvoiceCounter" ("id", "type", "value", "updatedAt")
VALUES (gen_random_uuid()::text, 'KD', 0, NOW());
```

`id` muss ein eindeutiger String sein (Prisma nutzt normalerweise `cuid()`; `gen_random_uuid()::text` ist für manuelle Inserts üblich).

### Andere Zähler (RE, GS, GBL, …) zurücksetzen

Gleiches Prinzip: **`value = 0`** setzen, wenn die **nächste** vergebene Nummer dem `INITIAL_VALUES[type] + 1` entsprechen soll — **nur** in Dev, wenn keine Kollision mit bereits versendeten Belegen droht.

---

## Hinweis Production

Wenn Nutzer bereits **KD-00002** usw. haben und du den Zähler auf **0** setzt, kann die nächste Vergabe wieder **KD-00001** erzeugen — **doppelte Kundennummer**. Vor einem Reset prüfen: höchste vergebene Nummer in `User.customerNumber` / `InvoiceCounter.value`.

---

*Letzte Aktualisierung: März 2026*

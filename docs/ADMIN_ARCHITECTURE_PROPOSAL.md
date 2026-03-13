# Admin-Architektur: Vorschlag zur Bestätigung

**Status:** ✅ Implementiert (März 2026)  
**Dokumentation:** [docs/ADMIN.md](./ADMIN.md)

---

## 1. Aktueller Zustand (Probleme)

| Thema | Beschreibung |
|-------|--------------|
| **Krücke** | Admin wird in der GlobalNav wie Profil behandelt (`titleForPath` → `"profile.adminDashboard"`). Kein eigenes Layout, nur Middleware-Check. |
| **Kein dediziertes Layout** | Es existiert kein `app/(app)/admin/layout.tsx`. Admin-Seiten hängen nur am `(app)`-Layout und der Middleware. |
| **404 Risiko** | `/admin/health-check` liegt unter `app/(app)/admin/health-check/page.tsx`. Falls 404: möglicherweise Build-Cache, fehlende Route-Registrierung oder Konflikt mit anderen Routen. |
| **Finanz-Sicherheit** | Einige Admin-Finanz-Routen schreiben außerhalb von Transaktionen (z.B. `refund`: `booking.update` nach Wallet-Service). Fehler können zu Inkonsistenzen führen. |

---

## 2. Vorgeschlagene neue Struktur

### 2.1 Admin-Layout (neu)

```
app/(app)/admin/
├── layout.tsx          ← NEU: dediziertes Admin-Layout mit strengem Guard
├── page.tsx
├── health-check/
│   └── page.tsx
├── finance/
│   └── page.tsx
├── safety/
│   └── ...
├── templates/
│   └── ...
└── ...
```

**layout.tsx** – Funktionsweise:

1. Server Component – ruft `auth()` (NextAuth v5 / `@auth/core`)
2. Prüft: `session?.user` vorhanden, `role === "admin"`
3. Optional (defense in depth): Prisma-Check `User` via `session.user.id` → `role`
4. Nicht eingeloggt → Redirect `/login?callbackUrl=/admin`
5. Kein Admin → Redirect `/home`
6. Rendert `{children}` – zentraler Guard für alle Admin-Seiten

**Warum:** Admin wird klar vom Profil getrennt. Alle Admin-Routen werden einmal zentral geschützt, nicht nur über die Middleware.

---

### 2.2 Routing-Fix

| Maßnahme | Begründung |
|----------|------------|
| Admin-Layout für alle `/admin/*` | Next.js wendet Layouts auf alle Kind-Segmente an. Ein Layout unter `admin/` sichert alle Unterseiten. |
| Middleware unverändert | Aktueller Check `pathname.startsWith("/admin")` bleibt; Layout ergänzt serverseitig. |
| Keine Dateiverschiebungen | Pfade bleiben wie gehabt, nur `layout.tsx` hinzugefügt. |

Falls 404 weiter besteht: Verzeichnisstruktur prüfen, `.next` leeren (`rm -rf .next`), Dev-Server neu starten.

---

### 2.3 Finanz-Operationen – Transaktionen & Fehlerbehandlung

| Route | Aktuell | Vorgeschlagen |
|-------|---------|---------------|
| `force-capture` | Ruft `processCompletion`; `AdminActionLog` nach Erfolg | `processCompletion` nutzt bereits `$transaction` für DB. Zusätzlich: `AdminActionLog` in `$transaction` mit dem letzten Schritt, wenn möglich. Fehler werden bereits geloggt. |
| `refund` | `creditRefundToShugyoWallet` / `refundTransactionForBooking` (beide nutzen `$transaction`), danach `booking.update` | `booking.update` + `AdminActionLog.create` in einer `$transaction`. |
| `manual-release` | Wallet/Stripe, dann `$transaction` für `booking.update` + `AdminActionLog` | Bereits korrekt gekapselt. Keine Änderung. |

Grundprinzip: Alle DB-Schreibzugriffe in Finanz-Routen laufen in Prisma-Transaktionen. Externe Aufrufe (Stripe) bleiben außerhalb; bei deren Fehlschlag wird nicht in der DB committet.

---

### 2.4 Code-Qualität & GlobalNav

| Änderung | Grund |
|----------|-------|
| `titleForPath`: Admin mit eigenem Key | Statt `profile.adminDashboard` eigener Key z.B. `admin.title` oder `globalNav.admin`. Admin-Bereich hat ein eigenes Label. |
| i18n-Key ergänzen | Falls noch nicht vorhanden: `admin.title` = "Admin". |

---

## 3. Dateien, die geändert/erstellt werden

| Aktion | Datei |
|--------|-------|
| **Erstellen** | `app/(app)/admin/layout.tsx` |
| **Anpassen** | `components/global-navigation.tsx` (Admin-Titel) |
| **Anpassen** | `app/api/admin/finance/refund/route.ts` (Transaktion für `booking.update` + `AdminActionLog`) |
| **Anpassen** | `app/api/admin/finance/force-capture/route.ts` (Fehlerlog und sauberer Ablauf, ggf. `AdminActionLog` in Transaktion) |
| **Prüfen** | i18n – Key für Admin-Titel |

---

## 4. Bestätigung erforderlich

Bitte bestätigen:

1. **Admin-Layout:** Einverstanden mit einem eigenen `layout.tsx` unter `admin/` mit Auth- und Role-Check?
2. **Routing:** Keine Verschiebung von Dateien, nur Layout und ggf. Middleware-Verständnis – passt das?
3. **Finanz-Transaktionen:** Sollen `refund` und `force-capture` wie oben angepasst werden?
4. **GlobalNav:** Soll Admin einen eigenen Titel bekommen (nicht mehr `profile.adminDashboard`)?

Sobald diese Punkte bestätigt sind, erfolgt die Implementierung schrittweise.

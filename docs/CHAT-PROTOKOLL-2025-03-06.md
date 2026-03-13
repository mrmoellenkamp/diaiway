# Chat-Protokoll – 6. März 2025

**Projekt:** diaiway.com | **Kontext:** Admin-Struktur, DSGVO, Deployment

---

## 1. Admin-Architektur & 404-Fix

**Anforderung:** Admin von Profil-Krücke entkoppeln, 404 für `/admin/health-check` beheben.

**Umsetzung:**
- `app/(app)/admin/layout.tsx` – dedizierter Server-Guard (NextAuth + Prisma-Role)
- GlobalNav: eigener i18n-Key `admin.title` statt `profile.adminDashboard`
- Middleware unverändert; Layout ergänzt serverseitig
- Health-Check-Route bereits vorhanden, durch Layout abgesichert

**Finanz-Sicherheit:**
- `refund`: `booking.update` + `AdminActionLog` in `prisma.$transaction`
- `force-capture`: `AdminActionLog` in `$transaction`, Fehlerlogging

---

## 2. Deployment (Vercel CLI)

**Ausgangslage:** Kein Git-Repository im Workspace; Deployment bisher per Vercel CLI.

**Problem:** Vercel Hobby – Cron `*/2 * * * *` (instant-request-cleanup) überschreitet Limit (nur 1× täglich).

**Anpassung:** `vercel.json` – `instant-request-cleanup` auf `0 8 * * *` (täglich 8:00).

**Ergebnis:** `vercel --prod` erfolgreich; diaiway.com live.

---

## 3. DSGVO-Kontoverwaltung (App Store)

**Anforderungen:**
- Löschung = Anonymisierung (kein Hard-Delete)
- Name/E-Mail → Platzhalter; Profilbild aus Blob löschen
- Wallet-Historie erhalten; alle Ops in Transaktion
- Admin-Konten schützen
- Pause: Takumi sofort `liveStatus: offline`

**Umsetzung:**
- `lib/anonymize-user.ts` – zentrale Anonymisierungslogik
- `DELETE /api/user/account` – Selbstlöschung
- `DELETE /api/admin/users/[id]` – Admin-Löschung
- Admin-Check in `anonymizeUser` → Fehler wenn `role === "admin"`
- PATCH `/api/user/account` (pause): zusätzlich `liveStatus: "offline"` für Expert
- Admin-Dashboard: Badge „Anonymisiert“ für `@anonymized.local`; kein Delete-Button für Admin/Anonymisierte

---

## 4. Dokumentation

**Aktualisiert:**
- `README.md` – Admin, Health-Check, Deployment (CLI), DSGVO, Rollen
- `docs/ARCHITECTURE.md` – API-Ergänzungen, Admin-Abschnitt, Sicherheit
- `docs/ADMIN.md` (neu) – Layout, Health-Check, Kontoverwaltung, Pause, Cron
- `docs/STORE-COMPLIANCE-CHECKLIST.md` – Abschnitt 5: DSGVO Kontoverwaltung
- `docs/UPDATE.md` – Referenz auf docs/ADMIN.md
- `docs/ADMIN_ARCHITECTURE_PROPOSAL.md` – Status: implementiert

---

## 5. Kurzreferenz: Test-User & Anonymisierung

| Schritt | Aktion |
|--------|--------|
| 1 | Test-User über `/register` anlegen |
| 2 | Einloggen → Profil → Konto → „Konto dauerhaft löschen“ |
| 3 | Im Admin unter Nutzer suchen: Name `user_deleted_xxx`, E-Mail `@anonymized.local`, Badge „Anonymisiert“ |

---

*Kompiliert am 6. März 2025*

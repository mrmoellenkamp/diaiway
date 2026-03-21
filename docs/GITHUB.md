# GitHub & Repository — Leitfaden

**Stand:** März 2026  

Dieses Dokument beschreibt, **wie dieses Repo mit GitHub zusammenspielt**: Workflows, Geheimnisse, CI, und wo welche Doku liegt.

---

## 1. Was im Repository liegt — und was nicht

### Im Git (geteilter Code)

- Quellcode (`app/`, `components/`, `lib/`, …)
- `prisma/schema.prisma` und **Migrationen** (`prisma/migrations/`)
- **`.env.example`** — nur Platzhalter, **keine** echten Secrets
- **`android/keystore.properties.example`** — Vorlage für Android-Signing
- Dokumentation (`docs/`, `README.md`)
- `.github/workflows/` — CI-Definitionen

### Niemals committen (steht in `.gitignore`)

| Pfad / Muster | Grund |
|----------------|--------|
| `.env`, `.env.local`, `.env.*.local` | Produktions- und Dev-Secrets |
| `node_modules/`, `.next/` | Build-Artefakte |
| `android/keystore.properties` | Keystore-Passwörter |
| `android/app/*.keystore`, `*.jks` | Signatur-Dateien |
| `out/*` (außer ggf. Platzhalter) | Capacitor-Sync-Artefakte |

**Merksatz:** Wer das Repo klont, soll **ohne** `.env` starten und `cp .env.example .env` ausfüllen — nicht umgekehrt echte Keys ins Repo schreiben.

---

## 2. GitHub Actions (`.github/workflows`)

### `ci.yml` — Lint & Typecheck

| Trigger | `push` / `pull_request` auf `main` oder `master` |
|---------|---------------------------------------------------|
| Schritte | Checkout → Node 20 → `npm ci` → `npm run check` |
| `npm run check` | `eslint` + `tsc --noEmit` |

- **Kein** Deployment, **keine** Datenbank — nur Code-Qualität.
- Schlägt fehl → PR sollte nicht gemerged werden, bis behoben.

### `docs-check.yml` — Doku & i18n

| Trigger | Push/PR auf `main`/`master`, **nur** wenn geändert: `lib/i18n/**`, `README.md`, `docs/**`, `scripts/check-docs.mjs`, diese Workflow-Datei |
|---------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Schritte | `npm ci` → `npm run docs:check` |
| Prüfung | u. a. fehlende i18n-Keys (DE → EN/ES müssen passen) |

Änderungen **außerhalb** dieser Pfade lösen den Workflow **nicht** aus (spart CI-Minuten).

---

## 3. GitHub vs. Vercel vs. Secrets

| Ort | Zweck |
|-----|--------|
| **GitHub Secrets** | z. B. für **GitHub Actions**, die deployen oder APIs aufrufen — nur wenn ihr solche Jobs habt. |
| **Vercel Environment Variables** | **Laufzeit** der Web-App: `DATABASE_URL`, `NEXTAUTH_SECRET`, Stripe, … |
| **Lokale `.env`** | Entwicklung auf dem Rechner |

Die **laufende Produktions-App** liest **nicht** automatisch GitHub Secrets — sie liest **Vercel** (oder den jeweiligen Host).

---

## 4. Branches & Empfehlungen

- **Default-Branch:** typisch `main` oder `master` (CI ist für beide konfiguriert).
- **Feature-Work:** eigener Branch → Pull Request → nach grünem CI mergen.
- Optional in GitHub: **Branch-Protection** für `main` (Reviews erforderlich, CI muss grün).

---

## 5. Pull-Request-Checkliste (kurz)

- [ ] `npm run check` lokal grün
- [ ] Bei Schema-Änderung: Migration committed, `docs/UPDATE.md` beachten
- [ ] Neue Env-Variablen: `.env.example` + `docs/ENV.md`
- [ ] Neue Admin-/API-Features: `docs/ADMIN.md` / `docs/ARCHITECTURE.md`
- [ ] i18n: Keys in `de.ts`, `en.ts`, `es.ts` (`docs:check`)

---

## 6. Dokumentations-Landkarte (einstieg)

| Datei | Inhalt |
|-------|--------|
| [README.md](../README.md) | Projektüberblick, Setup, Features |
| [INDEX.md](INDEX.md) | Alle Docs verlinkt |
| [CONTRIBUTING.md](CONTRIBUTING.md) | i18n, Stil, DB-Migrationen |
| [UPDATE.md](UPDATE.md) | Wann welche Doku anfassen |
| [ENV.md](ENV.md) | Umgebungsvariablen |
| [HIDDEN-MECHANICS.md](HIDDEN-MECHANICS.md) | „Verborgene“ Systemlogik |
| [ADMIN.md](ADMIN.md) | Admin-UI, Tabs, Unterseiten |
| [MOBILE-BUILD.md](MOBILE-BUILD.md) | Capacitor, Android-Signing |
| [DEPLOYMENT-AUTH.md](DEPLOYMENT-AUTH.md) | Production-Login, Cookies |

---

## 7. „Hidden“ aus Sicht GitHub

- **Kein** automatisches `prisma migrate deploy` in GitHub Actions (nur lokal / Vercel-Build laut `package.json` `build`-Script).
- **Keine** Secrets in Issues, PR-Beschreibungen oder Code-Kommentaren mit echten Werten.
- **Admin-Statistik** (`/api/admin/stats`) kann bei DB-Fehler **HTTP 200** mit `degraded: true` liefern — Monitoring nach **Inhalt** prüfen, nicht nur Statuscode (siehe [HIDDEN-MECHANICS.md](HIDDEN-MECHANICS.md)).

---

*Letzte Aktualisierung: März 2026*

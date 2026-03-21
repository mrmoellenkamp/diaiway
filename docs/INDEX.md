# diAIway Dokumentation – Index

**Stand:** März 2026  

Zentrale Einstiege und **alle** referenzierten Dokumente.

---

## Schnellzugriff

| Thema | Datei |
|-------|--------|
| **Projekt-Übersicht** | [README.md](../README.md) |
| **GitHub, CI, Secrets** | [GITHUB.md](GITHUB.md) |
| **Architektur & API** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Verborgene Mechaniken** | [HIDDEN-MECHANICS.md](HIDDEN-MECHANICS.md) |
| **Admin** | [ADMIN.md](ADMIN.md) |
| **Umgebungsvariablen** | [ENV.md](ENV.md) |
| **Production-Login / Safari** | [DEPLOYMENT-AUTH.md](DEPLOYMENT-AUTH.md) |
| **Beitragen (i18n, Stil)** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Doku pflegen** | [UPDATE.md](UPDATE.md) |

---

## Features (Kurzüberblick)

### Shugyo (Nutzer)
- AI-Guide, Kategorien (Taxonomie), Buchungen Video/Voice, Instant Connect, Sessions, Wallet, Postfach (Chat + Waymails), Profil, Session-Timeout, Push, Safety

### Takumi (Experten)
- Verfügbarkeit, Live-Status, Buchungsanfragen, Instant Connect

### Admin
- Dashboard mit **9 Tabs** inkl. **Statistik** (Website-Traffic); Unterseiten Taxonomie, Home-News, Finance, Health-Check, Safety, Templates; Vision-Scanner; DSGVO-Anonymisierung

### Öffentlich / Marketing
- **Beta-Landing** `/beta/de` | `/beta/en` | `/beta/es`
- **Home-News** auf der Startseite (`GET /api/home-news`)

### Technisch
- Next.js 16, Prisma, NextAuth, Stripe, Daily.co, Capacitor 8, i18n DE/EN/ES, E2EE-Calls, Site-Analytics (Beacon + DB), Vercel Analytics

---

## Alle Dokumente (vollständig)

| Datei | Inhalt |
|-------|--------|
| [README.md](../README.md) | Setup, Features, Tech-Stack, Deployment, Projektstruktur |
| [GITHUB.md](GITHUB.md) | GitHub Actions, .gitignore-Semantik, Secrets, PR-Checkliste |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Datenflüsse, Taxonomie, API-Hinweise, Geschäftsregeln |
| [HIDDEN-MECHANICS.md](HIDDEN-MECHANICS.md) | Idempotenz, Revocation, UI, Safety, Admin-Stats 200/degraded, Site-Analytics |
| [ADMIN.md](ADMIN.md) | Tabs, Unterseiten, Health-Check, Finanzen, DSGVO, Cron |
| [ENV.md](ENV.md) | Umgebungsvariablen |
| [CONTRIBUTING.md](CONTRIBUTING.md) | i18n, Lint, DB-Migrationen |
| [UPDATE.md](UPDATE.md) | Wann welche Datei aktualisieren |
| [MOBILE-READINESS.md](MOBILE-READINESS.md) | Mobile-Richtlinien |
| [MOBILE-BUILD.md](MOBILE-BUILD.md) | Capacitor, `out/`, Android-Signing, App Links |
| [DEEP-LINKING-SETUP.md](DEEP-LINKING-SETUP.md) | Universal Links, Waymail |
| [SECURE-FILE-EXCHANGE.md](SECURE-FILE-EXCHANGE.md) | Virenscan, Upload-Limits |
| [STORE-COMPLIANCE-CHECKLIST.md](STORE-COMPLIANCE-CHECKLIST.md) | Store-Compliance |
| [IOS-APP-STORE-COMPLIANCE.md](IOS-APP-STORE-COMPLIANCE.md) | iOS-spezifisch |
| [CALL-KEEP-SETUP.md](CALL-KEEP-SETUP.md) | Call-Keep (native) |
| [DEPLOYMENT-AUTH.md](DEPLOYMENT-AUTH.md) | NEXTAUTH_URL, WebKit |
| [EMAIL-VERIFICATION-MIGRATION.md](EMAIL-VERIFICATION-MIGRATION.md) | E-Mail-Verifizierung |
| [PREFLIGHT-AUDIT.md](PREFLIGHT-AUDIT.md) | Preflight-Audit |
| [kundennummer-zaehler.md](kundennummer-zaehler.md) | KD-Nummern / InvoiceCounter |

---

## API-Referenz (Stichworte — Details in ARCHITECTURE / Code)

| Bereich | Beispiel-Routen |
|---------|------------------|
| Auth | `/api/auth/*`, Heartbeat |
| Buchungen | `/api/bookings`, instant-*, pay-with-wallet |
| Sessions | `/api/daily/meeting`, `/api/sessions/*/terminate` |
| Admin | `/api/admin/stats`, `/api/admin/analytics`, `/api/admin/users`, `/api/admin/finance/*`, `/api/admin/home-news`, `/api/admin/taxonomy/*`, … |
| Öffentlich | `/api/home-news`, `/api/taxonomy/categories`, `/api/takumis` |
| Analytics | `POST /api/analytics/beacon` (öffentlich, kein `/admin`-Tracking) |
| Cron | `/api/cron/release-wallet`, `experts-offline`, `instant-request-cleanup`, `cleanup-safety-data` (Header `CRON_SECRET`) |
| Safety | `/api/safety/pre-check`, `snapshot`, … |
| Dateien | `/api/files/secure-upload` |

---

*Letzte Aktualisierung: März 2026*

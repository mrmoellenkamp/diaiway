# diAIway Dokumentation – Index

**Stand:** März 2026

---

## Schnellzugriff

| Thema | Datei |
|-------|--------|
| **Projekt-Übersicht** | [README.md](../README.md) |
| **Architektur & API** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Verborgene Mechaniken** | [HIDDEN-MECHANICS.md](HIDDEN-MECHANICS.md) |
| **Admin** | [ADMIN.md](ADMIN.md) |
| **Umgebungsvariablen** | [ENV.md](ENV.md) |
| **Production-Login / Safari** | [DEPLOYMENT-AUTH.md](DEPLOYMENT-AUTH.md) |

---

## Features (komplett)

### Shugyo (Nutzer)
- AI-Guide (diAIway intelligence), Kategorien, Buchungen (Video/Voice, max. 7 Tage)
- Instant Connect (60s Expiry); Abrechnung: Erstkontakt 5 Min gratis, Zweitkontakt 30 Sek gratis
- Sessions (5-Min-Handshake für Scheduled), Wallet (Stripe/Wallet)
- Postfach: Chat + Waymails (Posteingang/Postausgang), Löschen mit Bestätigung
- Username als Profilname, Favoriten, Konto pausieren/löschen
- Session Activity (15 Min Timeout, Warnung, Heartbeat)
- Push (Web + Native), Benachrichtigungen (löschbar)

### Takumi (Experten)
- Verfügbarkeit (15-Min-Kalender), Stornierungsrichtlinie, Live-Status
- Buchungsanfragen (E-Mail, In-App, Push), Instant Connect

### Admin
- Dashboard mit 8 Tabs (Übersicht, Nutzer, Buchungen, Takumis, Finanzen, Sicherheit, Scanner, System)
- Vision-Scanner (Google Cloud Vision): Labels, Objekte, OCR, Safe Search, Farben, Gesichter, Web
- Health-Check (Cron, Stripe-Escrow, Wallet, Push)
- Finance (Force Capture, Manual Release, Audit-Log, CSV/DATEV)
- Safety Incidents, Templates, Nutzerverwaltung

### Technisch
- Next.js 16, Prisma, NextAuth, Stripe, Daily.co, Capacitor 8
- **E2EE** (Video-Calls: P2P-Modus, sfu_switchover)
- i18n (DE, EN, ES), Secure File Upload, Safety (Vision API, Cloudmersive)
- Idempotenz, Session Revocation, LogoutBackGuard, Cache-Control, DB-Resilienz

---

## Alle Dokumente

| Datei | Inhalt |
|-------|--------|
| [README.md](../README.md) | Setup, Features, Tech-Stack, Deployment |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Datenflüsse, API-Übersicht, Geschäftsregeln |
| [HIDDEN-MECHANICS.md](HIDDEN-MECHANICS.md) | Idempotenz, Revocation, Optimistic UI, Instant-Abrechnung, Session Activity, LogoutBackGuard |
| [ADMIN.md](ADMIN.md) | Admin-Tabs, Vision-Scanner, Health-Check, DSGVO, Pause |
| [ENV.md](ENV.md) | Umgebungsvariablen |
| [MOBILE-READINESS.md](MOBILE-READINESS.md) | Mobile-Richtlinien |
| [MOBILE-BUILD.md](MOBILE-BUILD.md) | Capacitor Build |
| [DEEP-LINKING-SETUP.md](DEEP-LINKING-SETUP.md) | Universal Links, App Links |
| [SECURE-FILE-EXCHANGE.md](SECURE-FILE-EXCHANGE.md) | Virenscan, Upload-Limits |
| [STORE-COMPLIANCE-CHECKLIST.md](STORE-COMPLIANCE-CHECKLIST.md) | App-Store-Compliance |
| [IOS-APP-STORE-COMPLIANCE.md](IOS-APP-STORE-COMPLIANCE.md) | iOS-spezifisch |
| [CALL-KEEP-SETUP.md](CALL-KEEP-SETUP.md) | Call-Keep (native Calls) |
| [PREFLIGHT-AUDIT.md](PREFLIGHT-AUDIT.md) | Preflight-Audit |
| [EMAIL-VERIFICATION-MIGRATION.md](EMAIL-VERIFICATION-MIGRATION.md) | E-Mail-Verifizierung, Migration |
| [UPDATE.md](UPDATE.md) | Dokumentation aktuell halten |

---

*Letzte Aktualisierung: März 2026*

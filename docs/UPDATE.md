# Dokumentation aktualisieren

Diese Anleitung hilft, die GitHub-Dokumentation aktuell zu halten.

## Wann aktualisieren?

- Neue Features oder API-Routen
- Änderungen an Umgebungsvariablen
- Neue Abhängigkeiten
- Änderungen an der Projektstruktur
- Deployment-Anpassungen

## Zu aktualisierende Dateien

| Änderung | Datei(en) |
|----------|-----------|
| Neue Features, Tech-Stack | `README.md` |
| Neue Env-Variablen | `docs/ENV.md`, `.env.example` |
| Neue API-Routen, Abläufe | `docs/ARCHITECTURE.md` |
| Admin, Kontoverwaltung, Tabs, Scanner | `docs/ADMIN.md` |
| Safety, E2EE, Verborgene Mechaniken | `docs/ARCHITECTURE.md`, `docs/HIDDEN-MECHANICS.md` |
| i18n-Regeln | `docs/CONTRIBUTING.md` |
| Projektstruktur | `README.md` (Projektstruktur) |
| Dokumentations-Index | `docs/INDEX.md` |

## Automatisierte Prüfung

| Komponente | Beschreibung |
|------------|--------------|
| `npm run docs:check` | Lokales Skript: i18n-Sync (de→en, es), README-Sektionen |
| `.github/workflows/docs-check.yml` | GitHub Action: läuft bei Push/PR auf `lib/i18n/**`, `README.md`, `docs/**` |

Bei fehlenden i18n-Keys in `en.ts` oder `es.ts` schlägt der Check fehl.

## Checkliste vor Release

- [ ] README: Features (Voice-only, Handshake, Kategorien, E2EE, Admin-Tabs, Vision-Scanner), Tech-Stack, Schnellstart prüfen
- [ ] docs/ENV.md: Alle genutzten Variablen (inkl. Vision-Scanner: GOOGLE_VISION_*), Stripe Webhook-Events dokumentiert
- [ ] .env.example: Aktuell und ohne echte Secrets
- [ ] docs/ARCHITECTURE.md: API-Routen (pre-check, snapshot), E2EE, Safety-Terminierung, CallType, Abläufe aktuell
- [ ] docs/ADMIN.md: Tab-Layout, Vision-Scanner, Health-Check, DSGVO-Kontoverwaltung, Pause-Logik aktuell
- [ ] docs/HIDDEN-MECHANICS.md: Safety-Incident-Terminierung, neue Mechaniken
- [ ] docs/INDEX.md: Neue Docs eintragen
- [ ] "Letzte Aktualisierung" in README und docs anpassen

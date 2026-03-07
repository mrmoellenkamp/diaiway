# Dokumentation aktualisieren

Diese Anleitung hilft, die GitHub-Dokumentation aktuell zu halten.

## Automatisierte Prüfung

| Tool | Beschreibung |
|------|--------------|
| `npm run docs:check` | Prüft i18n-Sync (de → en, es) und README-Sektionen |
| GitHub Action | Läuft bei Push/PR auf `lib/i18n/**`, `README.md`, `docs/**` |

Die GitHub Action (`.github/workflows/docs-check.yml`) führt die gleichen Checks aus und bricht den Build ab, wenn:
- Keys in `de.ts` in `en.ts` oder `es.ts` fehlen
- README.md fehlt oder Pflicht-Sektionen fehlen

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
| i18n-Regeln | `docs/CONTRIBUTING.md` |
| Projektstruktur | `README.md` (Projektstruktur) |

## Automatisierte Prüfung

Die Dokumentation wird automatisch geprüft:

- **Lokal**: `npm run docs:check` – prüft i18n-Sync (de/en/es) und README-Sektionen
- **GitHub Actions**: Bei Push/PR auf `main`/`master` – wenn `lib/i18n/**`, `README.md`, `docs/**` oder `scripts/check-docs.mjs` geändert wurden

Die Workflow-Datei: `.github/workflows/docs-check.yml`

## Automation

Die Dokumentation wird automatisch geprüft:

| Komponente | Beschreibung |
|------------|--------------|
| `npm run docs:check` | Lokales Skript: i18n-Sync (de→en, es), README-Sektionen |
| `.github/workflows/docs-check.yml` | GitHub Action: läuft bei Push/PR auf `lib/i18n/**`, `README.md`, `docs/**` |

Bei fehlenden i18n-Keys in en.ts oder es.ts schlägt der Check fehl.

## Automation

Die Dokumentation wird automatisch geprüft:

- **Lokal**: `npm run docs:check` – prüft i18n-Sync (de → en, es) und README-Sektionen
- **GitHub Actions**: Bei Push/PR auf `main`/`master` – wenn `lib/i18n/**`, `README.md`, `docs/**` geändert wurden

Workflow: `.github/workflows/docs-check.yml`

## Automatisierte Prüfung

Die Dokumentation wird automatisch geprüft:

- **Lokal**: `npm run docs:check` – prüft i18n-Sync (de.ts → en.ts, es.ts) und README-Sektionen
- **GitHub Actions**: Bei Push/PR auf `main`/`master` – wenn `lib/i18n/**`, `README.md`, `docs/**` oder `scripts/check-docs.mjs` geändert wurden

Workflow: `.github/workflows/docs-check.yml`

## Checkliste vor Release

- [ ] README: Features, Tech-Stack, Schnellstart prüfen
- [ ] docs/ENV.md: Alle genutzten Variablen dokumentiert
- [ ] .env.example: Aktuell und ohne echte Secrets
- [ ] docs/ARCHITECTURE.md: API-Routen, Abläufe aktuell
- [ ] "Letzte Aktualisierung" in README anpassen

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
| i18n-Regeln | `docs/CONTRIBUTING.md` |
| Projektstruktur | `README.md` (Projektstruktur) |

## Automatisierte Prüfung

| Komponente | Beschreibung |
|------------|--------------|
| `npm run docs:check` | Lokales Skript: i18n-Sync (de→en, es), README-Sektionen |
| `.github/workflows/docs-check.yml` | GitHub Action: läuft bei Push/PR auf `lib/i18n/**`, `README.md`, `docs/**` |

Bei fehlenden i18n-Keys in `en.ts` oder `es.ts` schlägt der Check fehl.

## Checkliste vor Release

- [ ] README: Features, Tech-Stack, Schnellstart prüfen
- [ ] docs/ENV.md: Alle genutzten Variablen dokumentiert
- [ ] .env.example: Aktuell und ohne echte Secrets
- [ ] docs/ARCHITECTURE.md: API-Routen, Abläufe aktuell
- [ ] "Letzte Aktualisierung" in README anpassen

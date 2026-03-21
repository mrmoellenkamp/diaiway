# Dokumentation aktualisieren

Anleitung, damit **README**, **GitHub-Doku** und Fach-Docs zusammenbleiben.

## Wann aktualisieren?

- Neue Features, Routen oder Admin-Tabs
- Änderungen an Umgebungsvariablen oder `.env.example`
- Neue Prisma-Modelle / Migrationen
- CI-Workflows (`.github/workflows`)
- Deployment (Vercel, Cron, Capacitor)

## Zu aktualisierende Dateien (Matrix)

| Änderung | Datei(en) |
|----------|-----------|
| Features, Tech-Stack, Schnellstart, Ports | `README.md` |
| GitHub Actions, Secrets, .gitignore-Politik | `docs/GITHUB.md` |
| Neue Env-Variablen | `docs/ENV.md`, `.env.example` |
| API-Routen, Datenflüsse, Taxonomie, News, Analytics | `docs/ARCHITECTURE.md` |
| Admin-UI, Tabs, Unterseiten, Statistik | `docs/ADMIN.md` |
| Unsichtbare Logik (degraded Responses, Beacon, …) | `docs/HIDDEN-MECHANICS.md` |
| i18n-Regeln | `docs/CONTRIBUTING.md` |
| Capacitor / Android Signing | `docs/MOBILE-BUILD.md` |
| Dokumentations-Index | `docs/INDEX.md` |
| Diese Checkliste selbst | `docs/UPDATE.md` |

## Automatisierte Prüfung

| Komponente | Beschreibung |
|------------|--------------|
| `npm run docs:check` | i18n-Sync (de→en, es), README-Sektionen |
| `.github/workflows/docs-check.yml` | wie oben, bei Push/PR auf definierten Pfaden |
| `.github/workflows/ci.yml` | `npm run check` (Lint + Typecheck) |

## Checkliste vor Release / größerem Merge

- [ ] `README.md`: Admin-Tabs, Beta, Analytics, lokaler Port **3001**, neue Modelle
- [ ] `docs/INDEX.md` + `docs/GITHUB.md`: neue Docs verlinkt
- [ ] `docs/ENV.md` + `.env.example`: vollständig
- [ ] `docs/ARCHITECTURE.md`: neue öffentliche/admin APIs
- [ ] `docs/ADMIN.md`: Tab-Anzahl, Deep-Links (`?tab=analytics`), Unterseiten
- [ ] `docs/HIDDEN-MECHANICS.md`: neue „verborgene“ Verhaltensweisen
- [ ] `docs/MOBILE-BUILD.md`: falls native Konfiguration geändert
- [ ] `npm run docs:check` und `npm run check` lokal grün
- [ ] „Letzte Aktualisierung“ in stark geänderten Docs anpassen

---

*Letzte Aktualisierung: März 2026*

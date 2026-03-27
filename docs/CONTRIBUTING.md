# Beitragen

## GitHub & CI

- **Workflows:** [docs/GITHUB.md](./GITHUB.md) — was bei Push/PR automatisch läuft, was **nicht** ins Repo gehört (`.env`, Keystores).
- Vor einem PR lokal: `npm run check` (entspricht grob der CI).

## i18n (Übersetzungen)

- **Master-Sprache**: Deutsch (`lib/i18n/de.ts`)
- Änderungen in `de.ts` müssen in `en.ts` und `es.ts` übernommen werden
- **Unveränderliche Begriffe**: "Shugyo" und "Takumi" bleiben in allen Sprachen gleich

### Neue Keys hinzufügen
1. Key in `de.ts` ergänzen
2. Entsprechende Übersetzung in `en.ts` und `es.ts` ergänzen

**Rechtstexte / Gast-Flows:** Keys unter `guestCall.*` (öffentliche Call-Seite) und `guestInvite.*` (Takumi „Gast einladen“) in allen drei Dateien synchron halten; `npm run docs:check` prüft die i18n-Sync-Regeln.

### Kategorien
- Übersetzungen in `cat.{slug}`, `cat.{slug}.desc`, `cat.{slug}.sub{i}`
- Hook: `useCategories()` aus `lib/categories-i18n.ts`

## Code-Stil

- **Lint:** `npm run lint` (ESLint 9 Flat Config, Next.js 16 ohne `next lint`)
- **Auto-Fix:** `npm run lint:fix`
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`)
- **Alles vor PR/Release:** `npm run check` (= Lint + Typecheck)
- TypeScript: strikte Typen nutzen (`strict` ist aktiv)

## Datenbank-Änderungen

1. `prisma/schema.prisma` anpassen
2. `npx prisma db push` (Development) oder Migration erstellen
3. `npx prisma generate` ausführen

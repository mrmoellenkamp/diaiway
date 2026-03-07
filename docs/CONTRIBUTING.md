# Beitragen

## i18n (Übersetzungen)

- **Master-Sprache**: Deutsch (`lib/i18n/de.ts`)
- Änderungen in `de.ts` müssen in `en.ts` und `es.ts` übernommen werden
- **Unveränderliche Begriffe**: "Shugyo" und "Takumi" bleiben in allen Sprachen gleich

### Neue Keys hinzufügen
1. Key in `de.ts` ergänzen
2. Entsprechende Übersetzung in `en.ts` und `es.ts` ergänzen

### Kategorien
- Übersetzungen in `cat.{slug}`, `cat.{slug}.desc`, `cat.{slug}.sub{i}`
- Hook: `useCategories()` aus `lib/categories-i18n.ts`

## Code-Stil

- ESLint ausführen: `npm run lint`
- TypeScript: strikte Typen nutzen

## Datenbank-Änderungen

1. `prisma/schema.prisma` anpassen
2. `npx prisma db push` (Development) oder Migration erstellen
3. `npx prisma generate` ausführen

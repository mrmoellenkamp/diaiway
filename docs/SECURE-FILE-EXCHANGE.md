# Secure File Exchange

Sicheres Dateiversand-Modul für den Echtzeit-Chat und das Messaging-System.

## Features

- **Strikte Limits**: 2,5 MB maximal
- **Virenscan**: Cloudmersive API (optional, CLOUDMERSIVE_API_KEY)
- **Magic-Byte-Validierung** via Cloudmersive
- **Thumbnails**: Automatisch für Bilder (max. 200px)
- **Lazy-Loading**: Bilder laden erst bei Viewport-Sichtbarkeit
- **Native + Web**: input[type=file] funktioniert in WebView; optional @capawesome/capacitor-file-picker

## Setup

### 1. Umgebungsvariablen

```env
CLOUDMERSIVE_API_KEY="..."  # Optional; ohne Key wird Virenscan übersprungen
BLOB_READ_WRITE_TOKEN="vercel_blob_..."
```

### 2. Datenbank-Migration

**Wenn die DB bereits Tabellen hat (z.B. durch db push):** Prisma P3005 vermeiden:

```bash
# 1. SQL direkt ausführen (fügt die Spalten hinzu)
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20240312000000_add_message_attachments/migration.sql

# 2. Migration als angewendet markieren (Baseline)
npx prisma migrate resolve --applied 20240312000000_add_message_attachments
```

**Wenn die DB leer ist oder Migrations schon genutzt werden:**

```bash
npx prisma migrate deploy
```

### 3. Sharp (Thumbnails)

Sharp muss für das Ziel-System gebaut werden (z.B. auf Vercel automatisch).

## Erlaubte Formate

- Bilder: JPEG, PNG, WebP, GIF
- Dokumente: PDF

Blockiert: exe, bat, cmd, msi, scr, vbs, js, jar, php, py, sh, ps1, dll, so, dylib

## Fehlermeldungen (UX)

| Situation | Meldung |
|-----------|---------|
| > 2,5 MB | „Tipp: Verkleinere das Bild oder PDF, um die maximale Größe von 2,5 MB einzuhalten.“ |
| Cloudmersive Risiko | „Datei konnte nicht verarbeitet werden: Das Dokument entspricht nicht unseren Sicherheitsrichtlinien oder ist beschädigt.“ |
| Nicht erlaubtes Format | „Dieses Dateiformat wird aus Sicherheitsgründen nicht unterstützt.“ |

## Native File Picker (optional)

Für bessere UX auf iOS/Android:

```bash
npm install @capawesome/capacitor-file-picker
npx cap sync
```

Dann in `lib/secure-file-picker.ts` den nativen Branch aktivieren.

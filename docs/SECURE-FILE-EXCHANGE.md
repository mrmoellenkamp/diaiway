# Secure File Exchange

Sicheres Dateiversand-Modul für den Echtzeit-Chat und das Messaging-System.

## Features

- **Strikte Limits**: 2,5 MB für Chat-Anhänge (`/api/files/secure-upload`), 4 MB für Profil- und Portfolio-Bilder (`/api/upload`)
- **Virenscan**: Cloudmersive API (optional, `CLOUDMERSIVE_API_KEY`)
- **Magic-Byte-Validierung**: Cloudmersive für Dokumente; `sharp().metadata()` für Bild-Uploads (`/api/upload`) – der Client-MIME wird nicht vertraut.
- **Signierte Proxy-URLs** für sensible Dokumente (siehe unten)
- **Rate-Limits pro Route** (User + IP, Upstash) – verhindert Flood-Uploads
- **Thumbnails**: Automatisch für Bilder (max. 200px), werden ebenfalls signiert ausgeliefert
- **Lazy-Loading**: Bilder laden erst bei Viewport-Sichtbarkeit
- **Native + Web**: `input[type=file]` funktioniert in WebView; optional `@capawesome/capacitor-file-picker`

## Setup

### 1. Umgebungsvariablen

```env
CLOUDMERSIVE_API_KEY="..."    # Optional; ohne Key wird Virenscan übersprungen
BLOB_READ_WRITE_TOKEN="vercel_blob_..."
FILE_SIGNING_SECRET="..."     # Optional; HMAC-Key für signierte Proxy-URLs
                              # Fallback: NEXTAUTH_SECRET. Rotation invalidiert alle Alt-Links.
UPSTASH_REDIS_REST_URL="..."  # Rate-Limits – ohne Upstash In-Memory-Fallback pro Instanz
UPSTASH_REDIS_REST_TOKEN="..."
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

- Bilder: JPEG, PNG
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

## Signierte Proxy-URLs (`/api/files/signed`)

Sensible Dokumente werden in Vercel Blob als `public`-Blobs gespeichert (technisch notwendig für die Signed-SDK), dürfen aber **nicht** direkt mit ihrer `blob.vercel-storage.com`-URL an Clients gegeben werden – ein geleakter Link wäre dauerhaft offen.

Stattdessen:

1. `POST /api/files/secure-upload` lädt die Datei hoch und gibt dem Client **`signedUrl`** (und `thumbnailSignedUrl`) zurück, erzeugt via `signBlobProxyUrl(blob.url, { ownerUserId: session.user.id, ttlSec: 3600 })` (`lib/signed-url.ts`).
2. Die Signed-URL zeigt auf `/api/files/signed?u=<base64url(blobUrl)>&e=<expiry>&uid=<ownerUserId>&s=<hmac>`.
3. `GET /api/files/signed` prüft:
   - HMAC timing-safe gegen `FILE_SIGNING_SECRET` (Fallback `NEXTAUTH_SECRET`),
   - `e > now`,
   - `uid == session.user.id` (falls gesetzt),
   - Zielhost ist eine Vercel-Blob-Domain (kein offener Redirect).
4. Bei Erfolg: `302` → echte Blob-URL. Sonst: `403` und `logSecureWarn`.

**Rotation:** Neuer `FILE_SIGNING_SECRET`-Wert in Vercel setzen und redeployen. Alle zuvor ausgegebenen Links werden damit ungültig.

## Magic Bytes beim Bild-Upload (`/api/upload`)

- Der vom Browser gesendete `file.type` ist manipulierbar.
- Der Server lädt den `ArrayBuffer`, ruft `sharp(buffer, { failOn: "none" }).metadata()` auf und akzeptiert nur Formate aus der Allowlist (`jpeg`, `png`, `webp`, `gif`).
- Nach Magic-Byte-Check folgt die normale EXIF-/Größen-Optimierung.

## Rate-Limits

| Endpoint                             | Limit                          |
| ------------------------------------ | ------------------------------ |
| `POST /api/upload`                   | 40 / Stunde (User + IP)        |
| `POST /api/files/secure-upload`      | siehe Route                    |
| `GET /api/files/signed`              | IP-Limit                       |

Alle Buckets laufen über Upstash (`lib/api-rate-limit.ts`). Details und vollständige Liste: [SECURITY.md](../SECURITY.md) Abschnitt 4.6.

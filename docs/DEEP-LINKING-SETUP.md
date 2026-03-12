# Deep Linking – Abschluss-Setup

Die App enthält bereits den `DeepLinkHandler` und Android Intent-Filter. Für vollständige Universal Links (iOS) und App Links (Android) sind folgende Schritte nötig:

## iOS: Universal Links

1. **Apple Developer**: In deinem App-Identifier „Associated Domains“ aktivieren.
2. **Team ID eintragen**: In `public/.well-known/apple-app-site-association` die Platzhalter `TEAMID` durch deine Apple Team ID ersetzen (z.B. `8L65AZE66A`).
3. **Datei bereitstellen**: Sicherstellen, dass `https://diaiway.com/.well-known/apple-app-site-association` (ohne `.json`) erreichbar ist und `Content-Type: application/json` liefert.
4. **Xcode**: Signing & Capabilities → Associated Domains → `applinks:diaiway.com` und `applinks:www.diaiway.com` hinzufügen.
5. **Verifizierung**: [Apple App Search Validation Tool](https://search.developer.apple.com/appsearch-validation-tool/) nutzen.

## Android: App Links

1. **SHA256-Fingerprint ermitteln**:
   ```bash
   keytool -list -v -keystore android/app/release-key.keystore -alias mykey
   ```
2. **assetlinks.json anpassen**: In `public/.well-known/assetlinks.json` den Platzhalter `REPLACE_WITH_SHA256_FINGERPRINT` durch deinen SHA256-Fingerprint ersetzen.
3. **Datei bereitstellen**: `https://diaiway.com/.well-known/assetlinks.json` muss öffentlich erreichbar sein.
4. **Verifizierung**: [Google Asset Links Tool](https://developers.google.com/digital-asset-links/tools/generator) nutzen.

## Test

- Link in WhatsApp/Notes öffnen: `https://diaiway.com/takumi/123`
- Wenn die App installiert ist: App öffnet sich direkt auf dem Profil.
- Wenn nicht: Link öffnet die Webseite.

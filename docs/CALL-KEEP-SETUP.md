# Call-Keep Setup: Vollbild-Sperrbildschirm bei eingehenden Video-Calls

Damit eingehende Video-Calls wie echte Anrufe auf dem Sperrbildschirm erscheinen (iOS CallKit / Android ConnectionService), ist eine zusätzliche native Integration nötig.

## Anforderungen

- **iOS**: VoIP Push-Zertifikat bei Apple, PushKit-Berechtigungen
- **Android**: ConnectionService-Integration, FCM für Hintergrund-Trigger
- **Backend**: Push-Benachrichtigung muss beim eingehenden Call mit speziellem Payload gesendet werden

## Verfügbare Plugins

| Plugin | iOS | Android |
|--------|-----|---------|
| [Cap-go/capacitor-callkit-voip](https://github.com/Cap-go/capacitor-callkit-voip) | ✓ CallKit | – |
| [dyadical/capacitor-callkeep](https://github.com/dyadical/capacitor-callkeep) | ✓ CallKit | ✓ ConnectionService |

## Empfohlener Ansatz

1. **Plugin installieren**: z.B. `npm i @capgo/capacitor-callkit-voip` (oder `capacitor-callkeep`)
2. **iOS**: In Xcode → Signing & Capabilities → „Voice over IP“ hinzufügen
3. **Apple Developer**: VoIP Push-Zertifikat für `com.diaiway.app` erstellen (Push Certificates)
4. **Backend anpassen**: Bei eingehendem Instant-Call / Termin-Erinnerung einen VoIP-Push mit CallKit-Payload senden (APNs `voip` Environment)
5. **Client**: Listener für `callAnswered` / `callEnded` → Navigation zur Session-Seite bzw. Beenden

## Hinweis

Die aktuelle diAiway-App nutzt Standard-Push-Benachrichtigungen. Für echte CallKit/ConnectionService-Integration sind zusätzliche Backend-Änderungen und Zertifikats-Setup erforderlich. Dieses Dokument dient als Ausgangspunkt für die Umsetzung.

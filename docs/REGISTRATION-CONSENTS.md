# Registrierung — Einwilligungen (DSGVO / Verbraucherschutz)

## Überblick

Bei `/register` werden Pflicht- und Optional-Checkboxen angezeigt. Der Server validiert alle Zustimmungen erneut (`POST /api/auth/register`). Gespeichert werden Version und Zeitpunkt (Nachweispflicht), keine Klartext-IP (`registrationIpHash`).

## Umgebungsvariablen

| Variable | Bedeutung |
|----------|-----------|
| `LEGAL_CONSENT_VERSION` | Wird in `acceptedAgbVersion` / `acceptedPrivacyVersion` gespeichert. Bei inhaltlicher Änderung von AGB oder Datenschutz erhöhen und rechtlich prüfen, ob Nachziehen für Bestandsnutzer nötig ist. |
| `REGISTRATION_IP_PEPPER` | Optional; verstärkt den Hash der Registrierungs-IP. Fallback: `NEXTAUTH_SECRET`. |

## API-Payload (Beispiel)

```json
{
  "name": "…",
  "email": "…",
  "password": "…",
  "username": "…",
  "appRole": "shugyo",
  "consents": {
    "agbAndPrivacy": true,
    "earlyPerformanceWaiver": true,
    "paymentProcessor": true,
    "takumiExpertDeclaration": false,
    "marketing": false
  }
}
```

- **Shugyo:** `earlyPerformanceWaiver` muss `true` sein.  
- **Takumi:** `takumiExpertDeclaration` muss `true` sein; es wird ein leeres `Expert`-Profil angelegt (wie beim Wechsel im Profil).  
- **Marketing:** nur wenn `true`; niemals serverseitig voreintragen.

## Datenbankfelder (`User`)

Siehe `prisma/schema.prisma`: `acceptedAgbVersion`, `acceptedAgbAt`, `acceptedPrivacyVersion`, `acceptedPrivacyAt`, `earlyPerformanceWaiverAt`, `paymentProcessorConsentAt`, `takumiExpertDeclarationAt`, `marketingOptIn`, `marketingOptInAt`, `marketingDoubleOptInAt` (für späteren Newsletter-DOI), `registrationIpHash`.

## Marketing / Double-Opt-In

Die Checkbox dokumentiert die **Einwilligungsabsicht**. Technischer Versand von Newsletter/Marketing sollte erst nach separatem Bestätigungslink erfolgen; dafür ist `marketingDoubleOptInAt` vorgesehen (noch nicht angebunden).

## Rechtlicher Hinweis

Diese Implementierung ist **technische Unterstützung** und ersetzt keine Rechtsberatung. Texte und Fristen mit Fachanwalt abstimmen.

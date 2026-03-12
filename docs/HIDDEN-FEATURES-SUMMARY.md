# Hidden Features – Dokumentations-Gap-Analyse

**Erstellt:** März 2026  
**Zweck:** Zusammenfassung der im Code gefundenen Features, die in README.md oder ARCHITECTURE.md fehlten oder falsch beschrieben waren.

---

## Executive Summary

Die Dokumentation behandelte diAIway überwiegend als reine Web-App und erwähnte Capacitor nur als zukünftige Option. Tatsächlich ist die App eine vollwertige Hybrid-App mit Capacitor 8, zahlreichen nativen Plugins, Push-Benachrichtigungen (Web + native), Instant Connect, Admin Finance Monitoring und einer vollständig implementierten Session-Logik mit Daily.co und 5-Minuten-Handshake.

---

## 1. Capacitor / Hybrid App

### Dokumentation vorher
- MOBILE-READINESS.md: „Capacitor evaluieren“, „Migration geplant“
- README: Keine Erwähnung von Capacitor als aktuelle Komponente

### Code-Befund
- **Capacitor 8** vollständig integriert
- `capacitor.config.ts` vorhanden
- `ios/` und `android/` mit nativen Projekten
- Plugins in Nutzung:
  - `@capacitor/camera`
  - `@capacitor/push-notifications`
  - `@capacitor/local-notifications`
  - `@capacitor/haptics`
  - `@capacitor/network`
  - `@capacitor/preferences`
  - `@capacitor/share`
  - `@capacitor/splash-screen`
  - `@capacitor/app`
  - `capacitor-native-biometric`
- Komponenten: `deep-link-handler.tsx`, `splash-screen-hider.tsx`, `native-test-center.tsx`
- Hooks: `use-native-bridge.ts` (Camera, Push, Preferences)
- Lib: `native-utils.ts` (Haptics, Network, Share, LocalNotifications), `offline-cache.ts`

**Fazit:** Capacitor ist produktiv, nicht nur in Planung.

---

## 2. Push-Benachrichtigungen

### Dokumentation vorher
- README: Keine Beschreibung des Push-Systems
- ARCHITECTURE: Nur `/api/push/subscribe` in API-Tabelle, keine Erklärung der Architektur

### Code-Befund
- **Web Push** via `web-push` (VAPID), nicht Firebase/FCM
- `POST /api/push/subscribe` speichert `PushSubscription` (endpoint, p256dh, auth)
- `PushNotificationProvider` registriert Service Worker und subscribes Nutzer
- `sendPushToUser()` wird aus booking-respond, notification-service, messages, bookings aufgerufen
- Capacitor: `use-native-bridge.ts` hat `getPushToken()` für FCM/APNs
- Modell `PushSubscription` in Prisma

**Fazit:** Push ist implementiert; Web Push (VAPID) + Capacitor-native Push, nicht reines Firebase/FCM.

---

## 3. 5-Minuten-Handshake

### Dokumentation vorher
- README: Erwähnung „Trial 5 Min“, aber keine technische Tiefe
- ARCHITECTURE: „Unter 5 Min Session + bereits bezahlt → automatische Rückerstattung“

### Code-Befund
- `app/api/bookings/[id]/route.ts`: `end-session` mit `FREE_TRIAL_MINUTES = 5`
- `app/api/sessions/[id]/terminate/route.ts`: `HANDSHAKE_LIMIT_MS = 5 * 60 * 1000`
- **Case A** (< 5 Min): Release des Holds / Rückerstattung; `cancelled_in_handshake`
- **Case B** (≥ 5 Min): Capture oder Wallet-Freigabe
- `lib/wallet-service.ts`: `releaseReservation()`
- Prisma: `BookingStatus.cancelled_in_handshake`

**Fazit:** Handshake-Logik mit klarer Trennung in terminate-Route; Dokumentation war vereinfacht.

---

## 4. Stripe Hold/Capture

### Dokumentation vorher
- ARCHITECTURE: „Hold & Capture“ erwähnt, Details zu manual capture und Admin-Tools fehlten

### Code-Befund
- Stripe manual capture
- `cancelOrRefundPaymentIntent`, `processCompletion` in wallet-service
- Admin: `force-capture`, `manual-release` mit Doppelbestätigung
- Webhook: `payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`
- Stripe-Expiry: 7 Tage (nicht 24h wie ursprünglich in manchen Kommentaren)

**Fazit:** Hold/Capture voll implementiert; Admin-APIs waren nicht dokumentiert.

---

## 5. Wallet atomare Updates

### Dokumentation vorher
- ARCHITECTURE: „Takumi erhält pendingBalance bis processCompletion“ – ohne technische Details

### Code-Befund
- `lib/wallet-service.ts`: `payBookingWithWallet()` nutzt `updateMany` mit `where: { id, balance: { gte: amount } }` und `decrement`
- Race-condition-sicher durch atomare Prüfung von `balance >= amount`
- `WalletTransaction` für Audit (DEBIT/CREDIT)

**Fazit:** Wallet-Logik ist atomar und korrekt implementiert; vorher nicht dokumentiert.

---

## 6. Session (Daily.co)

### Dokumentation vorher
- ARCHITECTURE: **„Modul bereinigt – Neuimplementierung geplant“** – faktisch falsch

### Code-Befund
- Daily.co vollständig integriert
- `POST /api/daily/meeting` erstellt Meeting-Räume
- `DailyCallContainer.tsx` für Video/Voice-UI
- Sessions sind produktiv, keine Neuimplementierung geplant

**Fazit:** Session-Modul ist implementiert; ARCHITECTURE-Aussage war veraltet.

---

## 7. Instant Connect

### Dokumentation vorher
- Keine Erwähnung in README oder ARCHITECTURE

### Code-Befund
- `POST /api/bookings/instant` – Instant-Buchung anfordern
- `GET /api/bookings/instant-check` – Verfügbarkeit prüfen
- `PATCH /api/expert/live-status` – offline/available/in_call/busy
- `GET /api/expert/instant-requests` – eingehende Instant-Anfragen
- `liveStatus` im Expert-Modell
- `bookingMode: scheduled | instant` bei Buchungen

**Fazit:** Vollwertiges Instant-Connect-Feature; komplett undokumentiert.

---

## 8. Admin Finance

### Dokumentation vorher
- ARCHITECTURE: „Admin: Stats, Users, Bookings, Safety, DB-Tools, Wallet-Refund“ – Finance Monitoring fehlte

### Code-Befund
- `/admin/finance` – Finance Dashboard
- `/api/admin/finance/summary` – Escrow-Übersicht
- `/api/admin/finance/force-capture` – manueller Capture
- `/api/admin/finance/manual-release` – manuelle Freigabe
- `/api/admin/finance/audit-log` – Transaction-Audit-Log
- `/api/admin/finance/export?format=csv` – CSV-Export (DATEV-ready)
- `/api/admin/finance/datev` – DATEV-spezifischer Export
- `/api/admin/finance/pending-releases`, `process-release`, `refund`, `resend-invoice`
- `AdminActionLog`-Modell für Admin-Aktionen

**Fazit:** Umfangreiches Admin-Finance-System; war nicht dokumentiert.

---

## 9. 7-Tage-Buchungsfenster

### Dokumentation vorher
- Nicht erwähnt

### Code-Befund
- `lib/booking-date-validation.ts`: `MAX_BOOKING_DAYS_AHEAD = 7`
- Validierung gegen Vergangenheit und Fensterende
- UTC/Berlin-Zeitzone berücksichtigt

**Fazit:** Explizite Geschäftsregel, vorher undokumentiert.

---

## 10. Secure File Upload

### Dokumentation vorher
- ARCHITECTURE: `/api/upload` für Bild-Upload; secure-upload nicht erwähnt

### Code-Befund
- `POST /api/files/secure-upload`
- Busboy-Streaming
- Cloudmersive-Virenscan (optional)
- Speicherung in Vercel Blob

**Fazit:** Separater Endpunkt für sichere Dateiübertragung; war nicht dokumentiert.

---

## 11. CHAT vs MAIL (Waymail)

### Dokumentation vorher
- Nicht erwähnt

### Code-Befund
- `DirectMessage.communicationType`: CHAT vs MAIL
- Waymail-Links: `/messages?waymail={id}`
- Unterschiedliche Flows für In-App-Chat vs E-Mail-Kommunikation

**Fazit:** Zwei Kommunikationskanäle; vorher undokumentiert.

---

## 12. Deep-Linking

### Dokumentation vorher
- MOBILE-READINESS: Als geplant/optional beschrieben

### Code-Befund
- `components/deep-link-handler.tsx` – verarbeitet `App.getLaunchUrl()` (Capacitor)
- Web: `callbackUrl` nach Login für Waymail-Links
- Vollständig implementiert

**Fazit:** Deep-Linking ist vorhanden; Dokumentation war unklar.

---

## 13. Session Terminate API

### Dokumentation vorher
- Nicht in API-Übersicht

### Code-Befund
- `POST /api/sessions/[id]/terminate`
- Zentrale Logik für Handshake vs Capture
- Koordiniert Stripe, Wallet, Booking-Status

**Fazit:** Wichtiger Endpunkt; fehlte in der API-Dokumentation.

---

## 14. Biometrie

### Dokumentation vorher
- Nicht erwähnt

### Code-Befund
- `capacitor-native-biometric` als Dependency
- Optional für native Authentifizierung

**Fazit:** Vorhanden, aber optional; jetzt in Mobile-Readiness erwähnt.

---

## 15. Cron: experts-offline

### Dokumentation vorher
- ARCHITECTURE: Nur `release-wallet` in Cron-Tabelle

### Code-Befund
- `/api/cron/experts-offline` – setzt Experten nach Inaktivität auf offline

**Fazit:** Zweiter Cron-Job; war nicht dokumentiert.

---

## Zusammenfassung der Korrekturen

| Kategorie | Vorher (Docs) | Nachher (Docs) |
|-----------|---------------|---------------|
| App-Typ | Web-App | Hybrid-App mit Capacitor 8 |
| Session | „Neuimplementierung geplant“ | Daily.co implementiert |
| Push | Unklar / fehlend | Web Push (VAPID) + Capacitor Push dokumentiert |
| Capacitor | „Evaluieren“ / „Migration“ | Produktiv, Plugins aufgelistet |
| Admin Finance | Nicht erwähnt | Vollständige API- und UI-Beschreibung |
| Instant Connect | Nicht erwähnt | Vollständiger Flow dokumentiert |
| 7-Tage-Fenster | Nicht erwähnt | In Geschäftsregeln aufgeführt |
| Secure Upload | Nicht erwähnt | Endpunkt und Virenscan dokumentiert |
| Wallet | Nur konzeptionell | Atomare Updates, Balance-Guard erklärt |
| Handshake | Nur „5 Min Trial“ | Case A/B, terminate-API dokumentiert |
| Deep-Linking | Geplant | Implementiert und beschrieben |

---

*Dieses Dokument dient als Referenz für zukünftige Dokumentations-Updates.*

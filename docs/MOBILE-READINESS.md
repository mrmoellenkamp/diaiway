# Mobile-Readiness – iOS & Android (Capacitor)

**Status:** diAIway ist eine **Hybrid-App** mit Capacitor 8. iOS- und Android-Projekte sind in `ios/` und `android/` vorhanden. Diese Richtlinien unterstützen die Weiterentwicklung der nativen Builds.

---

## Inhaltsverzeichnis

- [Aktueller Stand](#aktueller-stand)
- [Capacitor & Native Plugins](#capacitor--native-plugins)
- [Entwicklungsrichtlinien](#entwicklungsrichtlinien)
- [Deep-Linking & Permissions](#deep-linking--permissions)
- [Checkliste pro Feature](#checkliste-pro-feature)
- [Zu vermeiden](#zu-vermeiden)
- [PWA & Manifest](#pwa--manifest)

---

## Aktueller Stand

| Aspekt | Status |
|--------|--------|
| Capacitor 8 | ✅ Hybrid-App mit `ios/` und `android/` |
| PWA Manifest | ✅ `manifest.json` mit standalone, theme_color, icons |
| Viewport | ✅ device-width, themeColor, initialScale |
| Safe Area | ✅ `pb-[max(0.5rem,env(safe-area-inset-bottom))]` in BottomNav |
| Responsive | ✅ Tailwind breakpoints, `useIsMobile` Hook |
| Touch-Ziele | ⚠️ Mind. 44×44px prüfen |
| Apple Icon | ✅ Referenz in metadata |
| Deep-Linking | ✅ `deep-link-handler.tsx`, `App.getLaunchUrl()` |
| Push (Web + Native) | ✅ Web Push (VAPID) + Capacitor Push (FCM/APNs); Quick Actions (ACCEPT/DECLINE) |
| Biometric Auth | ✅ @capgo/capacitor-native-biometric (optional) |
| Haptics | ✅ @capacitor/haptics (Quick Action: hapticHeavy) |

---

## Entwicklungsrichtlinien

### 1. Touch-freundliche UI

- **Mindestgröße**: Klickbare Elemente mind. 44×44px (Apple HIG) bzw. 48×48dp (Material)
- **Abstände**: Ausreichend Abstand zwischen tappable Elementen (min. 8px)
- **Kein Hover-only**: Wichtige Aktionen nicht nur per Hover – auch per Tap erreichbar

### 2. Viewport & Safe Areas

- **Notch/Home-Indicator**: `env(safe-area-inset-*)` für Bottom-Nav, Header, Modals
- **viewport-fit=cover**: Für Fullscreen auf Geräten mit Notch (optional in `viewport`)

### 3. Responsive First

- **Mobile-first**: Layout primär für kleine Screens entwerfen, dann erweitern
- **Breakpoints**: `sm` (640px), `md` (768px), `lg` (1024px) – `useIsMobile` nutzen
- **Max-width**: Content-Breite begrenzen (z.B. `max-w-lg`), nicht full-width auf Desktop

### 4. API & Logik

- **API-Routen**: Bereits REST/JSON – gut für alle Clients (Web, iOS, Android)
- **Auth**: NextAuth JWT – kann von nativen Apps via Cookie/Session oder Token übernommen werden
- **Keine DOM-spezifische Logik**: Kein `document`, `window` in Kernlogik – in Hooks/Client isolieren

### 5. Medien & Performance

- **Bilder**: `next/image` mit `sizes` für responsive Loading
- **Lazy Loading**: Schwere Komponenten (z.B. Video-Call) mit `dynamic(..., { ssr: false })`
- **Bundle-Größe**: Auf unnötige Dependencies achten – später für Mobile relevant

---

## Capacitor 8 & Native Plugins

Die App nutzt **Capacitor 8**. Alle Plugins sind in Produktion:

| Plugin | Version | Verwendung |
|--------|---------|------------|
| `@capacitor/core` | ^8.2.0 | Core Runtime |
| `@capacitor/app` | ^8.0.1 | Lifecycle, Deep-Links, `getLaunchUrl()` |
| `@capacitor/camera` | ^8.0.2 | Foto-Capture |
| `@capacitor/haptics` | ^8.0.1 | Haptisches Feedback; `hapticHeavy()` bei Quick Action Accept |
| `@capacitor/local-notifications` | ^8.0.2 | Lokale Benachrichtigungen |
| `@capacitor/network` | ^8.0.1 | Netzwerkstatus |
| `@capacitor/preferences` | ^8.0.1 | Key-Value-Speicher |
| `@capacitor/push-notifications` | ^8.0.2 | FCM/APNs-Token; Quick Action Listener |
| `@capacitor/share` | ^8.0.1 | System-Share |
| `@capacitor/splash-screen` | ^8.0.1 | Splash-Screen |
| `@capgo/capacitor-native-biometric` | ^8.4.2 | Biometrische Authentifizierung (optional) |

### Quick Action Push (Instant Connect)
- **Native**: `lib/quick-action-push-handler.ts` – `pushNotificationActionPerformed`; ACCEPT/DECLINE navigieren zu Session bzw. Decline-API
- **Web**: `public/sw.js` – `notificationclick` mit actions; Redirect zu `/api/bookings/[id]/instant-accept|instant-decline?token=`
- Android-Kanal: `BOOKING_REQUEST` (via `registerBookingRequestChannel`)

**Relevante Dateien:** `capacitor.config.ts`, `hooks/use-native-bridge.ts`, `lib/native-utils.ts`, `components/deep-link-handler.tsx`, `components/quick-action-push-provider.tsx`, `components/native-test-center.tsx`

---

## Deep-Linking & Permissions

- **Native**: `App.getLaunchUrl()` in `deep-link-handler.tsx` ausgewertet
- **Web**: `callbackUrl` nach Login für Waymail-Links
- **Permissions**: Camera, Push – Abfrage bei Nutzung; Push-Registrierung über `PushNotificationProvider`

---

## Checkliste pro Feature

Bei jedem neuen Feature prüfen:

- [ ] Touch-Ziele mind. 44×44px
- [ ] Auf 375px Breite (iPhone SE) getestet
- [ ] Keine Hover-only Interaktionen
- [ ] Safe-Area bei fixed/sticky Elementen
- [ ] API-Logik ohne `window`/`document` in Kernfunktionen
- [ ] i18n für alle Texte (bereits etabliert)

---

## Zu vermeiden

| Vermeiden | Grund |
|-----------|-------|
| `userScalable: false` dauerhaft | Barrierefreiheit, Nutzer mit Sehschwäche |
| `window`/`document` in Server-Code | Nicht SSR-kompatibel, problematisch für Native |
| Browser-spezifische APIs ohne Fallback | z.B. `navigator.share` – Fallback anbieten |
| Feste Pixelwerte für Touch-Ziele | Stattdessen min-h/min-w mit ausreichendem Wert |
| Zu viele/zu schwere Client-Bundles | Ladezeiten auf Mobile |

---

## PWA & Manifest

Aktuell in `public/manifest.json`:

- `display: "standalone"` – App-ähnliches Verhalten
- `orientation: "portrait"` – für Video-Sessions sinnvoll
- `theme_color`, `background_color` – konsistent mit Layout

**Optional für bessere PWA-Installation:**

- Icons in 192×192 und 512×512 für „Add to Home Screen“
- `scope` und `start_url` prüfen

---

## Nächste Schritte

1. **Touch-Ziele** auf 44×44px prüfen (Checkliste)
2. **Store-Listing**: Icons, Screenshots, Beschreibungen aktuell halten
3. **Testing**: Native Builds regelmäßig mit `npx cap run ios` / `npx cap run android` testen

---

*Letzte Aktualisierung: März 2026*

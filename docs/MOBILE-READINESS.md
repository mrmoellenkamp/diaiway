# Mobile-Readiness – iOS & Android Migration

Diese Dokumentation bereitet die Web-App auf die spätere Migration zu iOS und Android vor. Bei der Entwicklung der Web-App sollen diese Richtlinien berücksichtigt werden, damit der Übergang zu nativen Apps reibungslos verläuft.

---

## Inhaltsverzeichnis

- [Aktueller Stand](#aktueller-stand)
- [Entwicklungsrichtlinien](#entwicklungsrichtlinien)
- [Migration-Pfade](#migration-pfade)
- [Checkliste pro Feature](#checkliste-pro-feature)
- [Zu vermeiden](#zu-vermeiden)
- [PWA & Manifest](#pwa--manifest)

---

## Aktueller Stand

| Aspekt | Status |
|--------|--------|
| PWA Manifest | ✅ `manifest.json` mit standalone, theme_color, icons |
| Viewport | ✅ device-width, themeColor, initialScale |
| Safe Area | ✅ `pb-[max(0.5rem,env(safe-area-inset-bottom))]` in BottomNav |
| Responsive | ✅ Tailwind breakpoints, `useIsMobile` Hook |
| Touch-Ziele | ⚠️ Mind. 44×44px prüfen |
| Apple Icon | ✅ Referenz in metadata |

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

## Migration-Pfade

### Option A: Capacitor (empfohlen für schnellen Start)

- **Konzept**: Web-App in nativen Container packen
- **Vorteil**: Gleicher Code, Zugriff auf native APIs (Kamera, Push, etc.)
- **Aufwand**: Gering – nach Web-Finalisierung
- **Vorbereitung**: PWA-Manifest, viewport, safe-areas bereits umgesetzt

### Option B: React Native (Expo)

- **Konzept**: UI neu in React Native, Logik teilen
- **Vorteil**: Native Performance, eigenes Look & Feel
- **Aufwand**: Hoch – API-Layer und Auth wiederverwenden, UI neu bauen
- **Vorbereitung**: API-Routen sauber, Business-Logik in `lib/` ohne DOM

### Option C: PWA-only

- **Konzept**: Web-App als „Add to Home Screen“ – keine App-Stores
- **Vorteil**: Kein Store-Review, sofort nutzbar
- **Einschränkung**: Kein Push (außer Web Push), eingeschränkter Offline-Support

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

## Nächste Schritte (nach Web-Finalisierung)

1. **Capacitor evaluieren**: `npm init @capacitor/app`
2. **iOS/Android-Projekte anlegen**: Capacitor fügt `ios/` und `android/` hinzu
3. **Native Plugins**: Push, Kamera, etc. bei Bedarf
4. **Store-Listing**: Icons, Screenshots, Beschreibungen vorbereiten

---

*Letzte Aktualisierung: März 2026*

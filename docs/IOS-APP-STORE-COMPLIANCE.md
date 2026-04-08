# iOS App Store Konformität & UI-Qualität

**Stand:** März 2026  
**Ziel:** iPhone 15/16 perfekt abdecken, keine 1:1-Kopien von Apple SF Symbols.

---

## Übersicht umgesetzter Änderungen

| Bereich | Status | Details |
|---------|--------|---------|
| Safe Areas | ✅ | `env(safe-area-inset-*)` in allen relevanten Komponenten |
| Scroll-Ende | ✅ | `scroll-end-spacer` in Listen/Seiten mit Bottom-Nav |
| Bottom-Padding | ✅ | `pb-40` durch `pb-safe` ersetzt (Safe-Area-aware) |
| Icons | ✅ | `icon-paper` für Cut-out-Look, Differenzierung von SF Symbols |
| Responsive | ✅ | Relative Einheiten, Flex/Grid Wrap, max-width für Papp-Karten |

---

## 1. Safe Areas

### Globale Anpassungen

- **`app/globals.css`**: CSS-Variablen für `--safe-area-inset-*`
- **`body`**: `.app-bottom-space` mit `padding-bottom: max(6rem, calc(5rem + env(safe-area-inset-bottom)))`
- **`app/(app)/layout.tsx`**: `min-h-[100dvh]` statt `min-h-screen` für korrekte Viewport-Höhe
- **`components/page-container.tsx`**: `pb-[max(10rem,calc(6rem+env(safe-area-inset-bottom)))]` und `min-h-[100dvh-4rem]`
- **`components/bottom-nav.tsx`**: Safe-Area beim Fixed-Bottom-Nav
- **`components/app-header.tsx`**: Safe-Area oben (Notch)
- **`components/landing-header.tsx`**: Safe-Area oben

### Neue Utility-Klassen

```css
/* globals.css */
.pb-safe {
  padding-bottom: max(10rem, calc(6rem + env(safe-area-inset-bottom)));
}

.scroll-end-spacer {
  min-height: calc(6rem + env(safe-area-inset-bottom, 0px));
}
```

### Seiten mit `pb-safe` (ehemals `pb-40`)

- `app/(app)/dashboard/takumi/portfolio/page.tsx`
- `app/booking/respond/[id]/page.tsx`
- `app/(app)/profile/availability/page.tsx`
- `app/(app)/profile/edit/page.tsx`
- `app/paused/page.tsx`
- `app/legal/datenschutz/page.tsx`
- `app/reset-password/[token]/page.tsx`
- `app/legal/impressum/page.tsx`
- `app/login/page.tsx`
- `app/onboarding/page.tsx`
- `app/help/page.tsx`
- `app/legal/agb/page.tsx`
- `app/register/page.tsx`
- `app/forgot-password/page.tsx`
- `app/(app)/sessions/[id]/page.tsx`
- `app/(app)/takumi/[id]/page.tsx`

---

## 2. Scroll-Problematik

### Scroll-End-Spacer

Listen/Seiten mit Bottom-Nav erhalten am Ende einen unsichtbaren Spacer, damit der letzte Inhalt vollständig scrollbar ist:

- `components/category-detail-page-client.tsx` (Takumi-Liste)
- `app/(app)/profile/page.tsx`
- `app/(app)/messages/page.tsx`
- `app/(app)/sessions/page.tsx`

```tsx
<div className="scroll-end-spacer" aria-hidden />
```

---

## 3. Icon-Anpassungen (Pappentwicklungs-Thema)

### Hintergrund

Apple erwartet, dass Icons nicht 1:1 wie SF Symbols wirken. Lucide-Icons (Home, MessageSquare, User, Settings, Mail, Bell, Search usw.) sind bereits durch Strichstil und Proportionen unterschiedlich. Zusätzlich wurde ein **Cut-out-Look** eingeführt, der zum Pappentwicklungs-Thema passt.

### CSS-Klassen

```css
/* globals.css */
.icon-paper {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.06));
}
.icon-paper-active {
  filter: drop-shadow(0 1px 2px rgba(6, 78, 59, 0.15));
}
```

### Verwendung

- **Bottom-Nav** (`components/bottom-nav.tsx`): `icon-paper` + `icon-paper-active` bei aktiven Tabs
- **App-Header** (`components/app-header.tsx`): Bell, Search
- **User-Nav** (`components/user-nav.tsx`): User, Settings, CalendarClock, LogOut, LogIn

---

## 4. Checkliste pro neuer Seite

- [ ] Safe-Area: Oben (Notch) und unten (Home-Indicator) berücksichtigt
- [ ] `pb-safe` oder `PageContainer` statt festem `pb-40`
- [ ] Scroll-Listen: `scroll-end-spacer` am Ende
- [ ] Icons: `icon-paper` bei Navigation/Header-Icons

---

## 5. Responsive Design (alle Displaygrößen)

### Relative Einheiten
- **Hero-Höhe**: `min-h-[min(18rem,40vh)]` statt festem `280px` – skaliert mit Viewport
- **Radius**: `rem` statt `px` in globals.css (`--radius-sm`, `--radius-xl`)

### Flexbox/Grid mit Wrap
- **Kategorie-Grids**: `grid-cols-2 sm:grid-cols-3` – 2 Spalten auf kleinen iPhones (SE), 3 auf größeren
- **Card-Grid-Utility**: `.card-grid-responsive` für auto-fill Grids mit `minmax(min(100%,6.5rem),1fr)`

### Maximale Breiten & Zentrierung
- **PageContainer, Header, Bottom-Nav**: `w-full max-w-lg min-w-0 mx-auto`
- **Card-Komponente**: `max-w-full min-w-0` – verhindert Überlauf
- **Legal/Help-Seiten**: `max-w-lg min-w-0` für zentrierte Inhalte

### Safe-Area für alle Notch-Größen
- `.pt-safe`: `max(1rem, env(safe-area-inset-top))`
- `.pb-safe`: `max(10rem, calc(6rem + env(safe-area-inset-bottom)))` für Seiten
- `.px-viewport`: horizontal `max(1rem, env(safe-area-inset-left/right))`

---

## 6. Guthaben (Wallet), IAP und Marktplatz-Zahlung (Apple & Google)

**Kontext:**
- **Apple Guideline 3.1.1** verbietet den Kauf digitaler Güter in der App außerhalb von IAP. **Guideline 3.1.3(d)** erlaubt für **Peer-to-Peer-Dienste** (reale Dienstleistungen zwischen Personen) die Abwicklung außerhalb von IAP.
- **Google Play Guideline 4.8** verbietet externe Zahlungen für digitale Güter, wenn sie innerhalb der App initiiert werden. **User Choice Billing** (2023) und die **EU-DMA-Ausnahme** (2024) erlauben für Marktplatz-Apps externe Zahlungsflüsse.

**Umsetzung im Projekt (technisch):**

| Thema | Verhalten |
|-------|-----------|
| **Guthaben aufladen – iOS** | Kein nativer Checkout. Nutzer wird per **SFSafariViewController** (`@capacitor/browser`) auf `https://diaiway.com/profile/finances` weitergeleitet. Zahlung findet außerhalb der App statt. |
| **Guthaben aufladen – Android** | Identisch: Kein nativer Checkout. Nutzer wird per **Chrome Custom Tabs** (`@capacitor/browser`) auf `https://diaiway.com/profile/finances` weitergeleitet. Zahlung findet außerhalb der App-WebView statt. |
| **Guthaben verbrauchen** | Buchungszahlung mit bestehendem Guthaben in der App erlaubt – Kontext: reale Dienstleistung Takumi↔Shugyo, kein Kauf virtueller Währung. |
| **Neue Stripe-Zahlung für Buchung** | iOS: In-App-Browser (`SFSafariViewController`). Android: direkt in der WebView (`window.location.assign`). Einhaltung von 3.1.3(d) / Guideline 4.8 obliegt der finalen App-Review-Argumentation. |

**Technische Umsetzung:**
- Zentrale Hilfsfunktion: `lib/native-browser.ts` → `openExternalBrowser(url)`
  - Intern: `Capacitor.isNativePlatform()` → `Browser.open({ url })` (Capacitor Browser Plugin)
  - Web-Fallback: `window.open(url, "_blank")`
- Verwendet in: `components/wallet-topup-modal.tsx`, `app/(app)/profile/finances/page.tsx`

**Argumentationslinie für App-Review (iOS & Android):**
1. Wallet-Aufladung findet vollständig im **externen System-Browser** statt (separater Prozess, nicht App-WebView)
2. Guthaben wird für **reale Peer-to-Peer-Dienstleistungen** eingesetzt (Live-Beratung Takumi↔Shugyo)
3. Entspricht dem Modell von Uber, Airbnb, Fiverr – anerkannte Marktplatz-Ausnahme

Ausführliche Beleg- und Zahlungsarchitektur: [BILLING-DOCUMENTS-AND-PAYMENTS.md](./BILLING-DOCUMENTS-AND-PAYMENTS.md).

---

## Referenzen

- [MOBILE-READINESS.md](./MOBILE-READINESS.md) – Allgemeine Mobile-Richtlinien
- [STORE-COMPLIANCE-CHECKLIST.md](./STORE-COMPLIANCE-CHECKLIST.md) – Info.plist, Permissions, DSGVO
- [BILLING-DOCUMENTS-AND-PAYMENTS.md](./BILLING-DOCUMENTS-AND-PAYMENTS.md) – Belege, Stripe, Wallet-GBL

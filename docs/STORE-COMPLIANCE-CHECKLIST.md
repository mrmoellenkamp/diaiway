# Store Compliance Checklist

**Last check:** March 2026

---

## 1. iOS – Info.plist

### Usage Descriptions (NSCameraUsageDescription, NSPhotoLibraryUsageDescription, etc.)

| Key | English (base) | German (de.lproj/InfoPlist.strings) |
|-----|----------------|-------------------------------------|
| NSCameraUsageDescription | We need access to your camera for video consultations between Shugyo and Takumi. | Wir benötigen Zugriff auf deine Kamera für die Video-Beratung zwischen Shugyo und Takumi. |
| NSMicrophoneUsageDescription | We need access to your microphone so you can communicate during your consultation. | Wir benötigen Zugriff auf dein Mikrofon, damit du dich während der Beratung unterhalten kannst. |
| NSPhotoLibraryUsageDescription | We need access to your photo library to upload images for your project or profile. | Wir benötigen Zugriff auf deine Fotogalerie, um Bilder für dein Projekt oder dein Profil hochzuladen. |
| NSFaceIDUsageDescription | Face ID is used for secure sign-in and to protect your data. | Face ID wird zur sicheren Anmeldung und zum Schutz deiner Daten verwendet. |

**Localization:** `en.lproj/InfoPlist.strings` and `de.lproj/InfoPlist.strings` are present. Ensure they are added to the Xcode project (Target → Info → Localizations) if not picked up automatically.

---

## 2. Android – AndroidManifest.xml Permissions

| Permission | Purpose |
|------------|---------|
| `android.permission.INTERNET` | Network (API, WebView) |
| `android.permission.CAMERA` | Camera for video calls |
| `android.permission.READ_MEDIA_IMAGES` | Photos (Android 13+) |
| `android.permission.READ_EXTERNAL_STORAGE` (maxSdkVersion 32) | Photos (pre-Android 13) |
| `android.permission.POST_NOTIFICATIONS` | Push notifications |
| `android.permission.SCHEDULE_EXACT_ALARM` | Exact alarms (local notifications) |
| `android.permission.USE_BIOMETRIC` | Biometric auth |
| `android.permission.USE_FINGERPRINT` | Legacy fingerprint (older devices) |
| `android.hardware.camera` (required=false) | Camera optional for voice-only |
| `RECORD_AUDIO` | Microphone for voice sessions |
| `MODIFY_AUDIO_SETTINGS` | Audio routing in calls |

**App Links:** `autoVerify="true"` for `https://diaiway.com` and `https://www.diaiway.com`.

**Google Play (Detail):** [GOOGLE-PLAY-COMPLIANCE.md](./GOOGLE-PLAY-COMPLIANCE.md) — Data safety, Console-Checkliste, Richtlinien-Schwerpunkte.

---

## 3. Assets (App Icons & Splash Screens)

### iOS
- **AppIcon:** `Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024×1024)
- **Splash:** `Splash.imageset` – 1x/2x/3x light + dark variants; custom blue-on-white branding (not Capacitor default)

### Android
- **Icons:** `mipmap-*/ic_launcher*.png` – full set (ldpi–xxxhdpi)
- **Splash:** Via `@capacitor/core` splash screen (runtime)
- **Play Store screenshots:** Smartphone → `scripts/frame-play-store-screenshots.mjs` (`assets/play-store-screenshots/`). **Tablet** (Pflicht bei Tablet-/Large-Screen-Support): `scripts/frame-play-store-tablet-screenshots.mjs` → `assets/play-store-screenshots-tablet/` — [GOOGLE-PLAY-COMPLIANCE.md](./GOOGLE-PLAY-COMPLIANCE.md) §3.1.

**Note:** Replace Capacitor defaults with brand assets before store submission. Use `npx @capacitor/assets generate` with your logo/splash source.

---

## 4. Versioning

| Platform | Version | Build/Code |
|----------|---------|------------|
| iOS | 1.0.0 (MARKETING_VERSION) | 1 (CURRENT_PROJECT_VERSION) |
| Android | 1.0.0 (versionName) | 1 (versionCode) |

---

## 5. DSGVO-konforme Kontoverwaltung (App Store)

### Konto löschen (Anonymisierung)

| Aspekt | Implementierung |
|--------|------------------|
| **Kein Hard-Delete** | User-Record bleibt; Name/E-Mail → Platzhalter `user_deleted_xxx@anonymized.local` |
| **Kommunikation & Geräte** | DirectMessage, Notification, Push/Web-Push, FCM-Token, Shugyo-/Takumi-Projekte werden entfernt; Analytics-Sessions vom Konto getrennt |
| **Buchungs-Freitexte** | `note`, `expertReviewText`/`expertRating` (Takumi) bereinigt |
| **Wallet-Historie** | Erhalten (§ 147 AO); `WalletTransaction` weiterhin dem anonymisierten User zugeordnet |
| **Profilbilder** | Physisch aus Vercel Blob gelöscht (`del()` nach DB-Transaktion, inkl. Projekt-/Chat-Anhänge) |
| **DB-Transaktion** | Alle Schritte in `prisma.$transaction`; Blob-Delete danach |
| **Admin-Schutz** | Admin-Konten können nicht gelöscht werden (Fehlermeldung) |

**Routen:**
- `DELETE /api/user/account` – Selbstlöschung (Profil → Konto)
- `DELETE /api/admin/users/[id]` – Admin-Löschung (Dashboard → Nutzer)

**Prüfung:** Test-User registrieren, löschen, im Admin-Dashboard prüfen: Badge „Anonymisiert“, E-Mail `@anonymized.local`.

### Konto pausieren

- Takumi: `liveStatus` wird sofort auf `offline` gesetzt → erscheint nicht mehr im Instant-Connect
- Pausierte Nutzer: Redirect zu `/paused`; Reaktivierung jederzeit möglich

---

## 6. Zahlungen & App Review (Marktplatz / IAP)

| Aspekt | Hinweis für Einreichung |
|--------|-------------------------|
| **Peer-to-Peer / reale Dienste** | diAiway vermittelt **Live-Beratung** zwischen Personen — Argumentationslinie zu **Apple Guideline 3.1.3(d)** (nicht 1:1 rechtlicher Rat). |
| **Wallet / Guthaben** | **Aufladung** in der nativen iOS-App vermeiden bzw. auf Web verweisen (**3.1.1**); **Verbrauch** für bezahlte Buchungen separat dokumentieren (siehe [IOS-APP-STORE-COMPLIANCE.md](./IOS-APP-STORE-COMPLIANCE.md) Abschnitt 6). |
| **Belege** | Wallet-Aufladung = **GBL** (Guthabenbeleg), keine §14-UStG-Rechnung; Session-Ende = RE/GS/PR — siehe [BILLING-DOCUMENTS-AND-PAYMENTS.md](./BILLING-DOCUMENTS-AND-PAYMENTS.md). |

---

## Pre-Submission

- [ ] Replace placeholder/custom icons and splash with final brand assets
- [ ] Confirm `google-services.json` present for FCM (Android push)
- [ ] Test deep links: `https://diaiway.com/messages?waymail=...`
- [ ] Verify `CFBundleDisplayName` / `app_name` for store listing
- [ ] DSGVO: Test Konto löschen (Anonymisierung), im Admin prüfen
- [ ] **Google Play:** [GOOGLE-PLAY-COMPLIANCE.md](./GOOGLE-PLAY-COMPLIANCE.md) abarbeiten (Data safety, Inhaltsbewertung, `versionCode`)

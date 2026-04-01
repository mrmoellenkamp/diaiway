# Google Play – Compliance & Einreichung

**Stand:** März 2026  

Dieses Dokument ergänzt [STORE-COMPLIANCE-CHECKLIST.md](./STORE-COMPLIANCE-CHECKLIST.md) (gemeinsame technische Basis) und [MOBILE-BUILD.md](./MOBILE-BUILD.md) / [MOBILE-READINESS.md](./MOBILE-READINESS.md).  

**Keine Rechtsberatung:** Richtlinien ändern sich; vor der Ersteinreichung die aktuellen [Google Play Developer Policy](https://play.google.com/about/developer-content-policy/) und ggf. juristische Prüfung einbeziehen.

---

## 1. Technischer Stand im Repo (Android)

| Thema | Stand | Datei / Quelle |
|-------|--------|----------------|
| `applicationId` | `com.diaiway.app` | `android/app/build.gradle` |
| `versionName` / `versionCode` | z. B. 1.0.1 / 2 (bei Release hochzählen) | `android/app/build.gradle` |
| `compileSdkVersion` | **36** | `android/variables.gradle` |
| `targetSdkVersion` | **35** | `android/variables.gradle` |
| `minSdkVersion` | **29** (Android 10) | `android/variables.gradle` |

**Hinweis:** Google fordert regelmäßig **höhere targetSdk**-Mindestwerte für *neue* Releases. Vor jedem Production-Upload in der Play Console die **aktuellen Anforderungen** prüfen und ggf. `targetSdkVersion` / `compileSdkVersion` anheben (Capacitor-Release-Notes beachten).

---

## 2. Manifest & Berechtigungen (Abgleich mit Play Console)

Berechtigungen in `android/app/src/main/AndroidManifest.xml` müssen zu **tatsächlicher Nutzung** und zu den Angaben unter **App-Inhalt → Berechtigungen / Datensicherheit** passen.

| Permission / Feature | Nutzung in der App |
|----------------------|---------------------|
| `INTERNET` | WebView, APIs |
| `CAMERA` | Video-Sessions (Daily.co) |
| `RECORD_AUDIO` | Voice-Calls, Mikrofon in Sessions |
| `MODIFY_AUDIO_SETTINGS` | Audio-Routing in Calls |
| `READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` (≤32) | Bild-Upload (Profil, Projekte, Mentor-Chat) |
| `POST_NOTIFICATIONS` | Push (Android 13+) |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Lokale Termin-/Session-Erinnerungen |
| `USE_BIOMETRIC` | Optional: Biometric Login |
| `android.hardware.camera` `required=false` | Voice-only ohne Kamera möglich |

**Netzwerk:** `usesCleartextTraffic="false"` + `networkSecurityConfig` – für Datensicherheits-Fragen („Verschlüsselung in Transit“) relevant.

---

## 3. Play Console – Pflichten (manuell)

- [ ] **Entwicklerkonto** inkl. ggf. Organisationsverifizierung
- [ ] **App erstellen** (Produktion / geschlossener Test / offener Test)
- [ ] **Store-Eintrag:** Kurz-/Langbeschreibung, Grafiken (Phone + ggf. Tablet), Symbol, Feature-Grafik falls gefordert
- [ ] **Datenschutzerklärung-URL** (öffentlich erreichbar, Sprache passend)
- [ ] **Kontaktdaten** (E-Mail, ggf. Website)
- [ ] **Inhaltsbewertung** (IARC-Fragebogen)
- [ ] **Zielgruppe** / Kinder (wenn nicht für Kinder: korrekt angeben)
- [ ] **News-Apps / COVID / Finanzen** etc. nur ankreuzen, wenn zutreffend
- [ ] **Datensicherheit (Data safety):** Formular vollständig; muss mit [Abschnitt 4](#4-datensicherheit-data-safety--orientierung) und der echten Datenverarbeitung übereinstimmen
- [ ] **App-Zugriff:** Testzugänge bereitstellen, falls Login nötig (Review)
- [ ] **Ads:** korrekt, ob die App Werbung zeigt (Vercel Analytics ≠ In-App-Werbung – trotzdem konsistent erklären)

---

## 4. Datensicherheit (Data safety) – Orientierung

Die Play Console fragt u. a. nach **erhobenen / übermittelten Daten** und **Zweck**. Anhand der Produktfunktionen typischerweise prüfen (Liste nicht vollständig – intern validieren):

| Datenkategorie | Mögliche Quelle in diAiway | Hinweis |
|----------------|----------------------------|---------|
| Name, E-Mail, Konto | Registrierung, Profil | Kontodaten |
| Telefon / Kontakte | Nur falls Features das nutzen | Sonst „nein“ |
| Fotos / Videos | Uploads, Safety-Snapshots wo implementiert | Zweck: Profil, Beratung, Moderation |
| Audio | Voice-Calls | Echtzeit-Dienst, ggf. Aufzeichnungs-Hinweis nur wenn zutrifft |
| Zahlungsinfos | Stripe / externe Zahlungsseite | Oft „über Drittanbieter verarbeitet“ |
| Standort | Nur wenn genutzt | Standard oft nein |
| App-Aktivität / Diagnose | Analytics, Logs | In [HIDDEN-MECHANICS.md](./HIDDEN-MECHANICS.md) / Beacon beschrieben |
| Nachrichten | Chat, Waymail | Nutzer-zu-Nutzer-Inhalte |

**Verschlüsselung:** HTTPS für API (Standard); sensible Bereiche gemäß Implementierung beantworten.

**Löschung:** Konto-Löschung / Anonymisierung – siehe [STORE-COMPLIANCE-CHECKLIST.md](./STORE-COMPLIANCE-CHECKLIST.md) Abschnitt 5; in Data safety „Löschung anfordern“ passend setzen.

---

## 5. Richtlinien-Schwerpunkte für diAiway

- **Nutzer-generierte Inhalte (UGC):** Chat, Video/Voice, Bewertungen – Richtlinien zu Moderation, Meldung, Enforcement (Safety-Features, Admin) in der **Store-Beschreibung** oder **App** klar adressieren, wo Google es erwartet.
- **Gesundheits- / Beratungs-Claims:** Keine irreführenden medizinischen Versprechen; Formulierungen zur **Informations- / Expertise-Vermittlung** mit Profis abstimmen.
- **Zahlungen:** Wallet, Stripe, Buchungen – Abgrenzung zu **Google Play Billing** für digitale Güter vs. **physische/reale Dienstleistungen** klären (siehe [BILLING-DOCUMENTS-AND-PAYMENTS.md](./BILLING-DOCUMENTS-AND-PAYMENTS.md), iOS-Argumentation in [IOS-APP-STORE-COMPLIANCE.md](./IOS-APP-STORE-COMPLIANCE.md) als inhaltliche Parallele, **nicht** 1:1 auf Google übertragbar ohne Prüfung).

---

## 6. Push (FCM)

- Ohne `android/app/google-services.json` kein FCM im nativen Build (siehe [MOBILE-READINESS.md](./MOBILE-READINESS.md)).
- Für Produktion: Firebase-Projekt, JSON einbinden, `NEXT_PUBLIC_ANDROID_FCM_ENABLED=true` im Web-Build, Release testen.

---

## 7. App Links (Deep Links)

- `intent-filter` mit `autoVerify` für `https://diaiway.com` und `https://www.diaiway.com` – **Digital Asset Links** auf dem Server müssen passen (siehe [DEEP-LINKING-SETUP.md](./DEEP-LINKING-SETUP.md)).
- Vor Release: manuell testen (Waymail, Session-Links).

---

## 8. Pre-Submission (Google – Kurzcheckliste)

- [ ] `versionCode` erhöht gegenüber letztem Upload
- [ ] Release-APK/AAB mit **Release-Signing** ([MOBILE-BUILD.md](./MOBILE-BUILD.md))
- [ ] Auf **echtem Gerät** (mind. ein Android 10–14): Login, Buchung, Call, Push, Deep Link
- [ ] Data safety & Store-Texte auf **Deutsch/Englisch** konsistent zur App
- [ ] Datenschutz & AGB im Web erreichbar (URLs in Console)
- [ ] Screenshot-Set ohne irreführende Features

---

## 9. Verwandte Dokumente

| Dokument | Inhalt |
|----------|--------|
| [STORE-COMPLIANCE-CHECKLIST.md](./STORE-COMPLIANCE-CHECKLIST.md) | iOS + Android Manifest, Icons, DSGVO-Löschung, Zahlungs-Hinweise |
| [MOBILE-BUILD.md](./MOBILE-BUILD.md) | Build, Signing, `out/` |
| [MOBILE-READINESS.md](./MOBILE-READINESS.md) | Capacitor, FCM, Plugins |
| [ENV.md](./ENV.md) | `NEXT_PUBLIC_ANDROID_FCM_ENABLED`, … |
| [IOS-APP-STORE-COMPLIANCE.md](./IOS-APP-STORE-COMPLIANCE.md) | Parallele App-Store-Themen (Zahlungen, Wallet) |

---

## 10. English summary (for reviewers / Play Console notes)

Short reference you can paste or adapt for **Play Console → App access**, **review notes**, or internal handover. **Not legal advice.**

**What the app is**  
diaiway is a **marketplace for live consultations** between users (“Shugyo”) and independent experts (“Takumi”). It offers **scheduled and on-demand video/voice sessions**, messaging, wallet-based payments where applicable, and an **in-app AI guide** (mentor chat) for orientation—not a substitute for professional advice in regulated fields.

**Technical form**  
**Capacitor 8** hybrid app: the UI loads the **hosted web app** in a WebView. **Package:** `com.diaiway.app`. **Min SDK:** 29 (Android 10). **Target SDK:** 35; **compile SDK:** 36 (see `android/variables.gradle`).

**Why we request permissions**  
- **Internet:** API and WebView content.  
- **Camera / microphone / audio settings:** real-time **video and voice calls** (third-party RTC).  
- **Photos / media:** profile, projects, optional attachments in chat.  
- **Notifications:** booking reminders and session-related push (FCM when configured).  
- **Exact alarms:** local reminders where implemented.  
- **Biometric:** optional login.  
Camera is **not required** (`required=false`) so voice-only use is supported.

**User-generated content & safety**  
Users can exchange **messages**, join **live calls**, and leave **reviews**. The product includes **reporting, moderation, and admin workflows** (see in-app safety flows and server-side policies). UGC policies in the store listing should match what the app actually offers.

**Account & data**  
Users can **register and delete their account**; deletion follows a **documented anonymisation** process (retention where law requires, e.g. billing records). Privacy policy URL must stay accurate.

**Payments**  
Payments use **external flows** (e.g. **Stripe**, wallet) as documented in the product—not Google Play In-app Billing for the same items unless your legal/product review says otherwise. Align **Data safety** and **Payments policy** declarations with the live implementation.

**Ads**  
The app does **not show third-party advertising units** in the UI. Product analytics (e.g. site/app usage) should be declared under **Data safety** as required, distinct from “contains ads” if applicable.

**Review access**  
If login is required, provide **test credentials** or a **demo path** in Play Console **App content → App access**, plus any steps to reach a video/voice test call if reviewers must verify permissions.

---

*Bei Änderungen an Android-SDK, Manifest oder Zahlungsflow: dieses Dokument und die Data-safety-Angaben in der Play Console aktualisieren.*

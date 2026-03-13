# Architektur

## Übersicht

diAIway ist eine **Hybrid-App**: Next.js 16 (App Router) mit Capacitor 8 für iOS und Android. Backend: PostgreSQL (Prisma), NextAuth.js, Stripe (Hold & Capture), Daily.co (Video/Voice), Web Push + Capacitor Push.

---

## Tech-Stack (Aktuell)

| Komponente | Technologie |
|------------|-------------|
| Framework | Next.js 16 (App Router) |
| Datenbank | PostgreSQL + Prisma |
| Auth | NextAuth.js v5 (Credentials, JWT) |
| Zahlung | Stripe (Hold & Capture, Webhooks) |
| Video/Voice | Daily.co (`@daily-co/daily-js`) |
| Mobile | Capacitor 8 (ios/, android/) |
| Push | web-push (VAPID), Firebase Admin (FCM), @capacitor/push-notifications |
| Storage | Vercel Blob |
| AI | Vercel AI SDK (Gemini) |
| Safety | Google Cloud Vision API, Cloudmersive |

---

## Datenfluss

### Authentifizierung
- **NextAuth.js v5** mit Credentials Provider
- JWT: `id`, `name`, `email`, `role`, `appRole`, `status`
- Middleware: geschützte Routen, pausierte Konten, Admin-Routing

### Buchungsablauf (Vorauszahlung)

1. Shugyo wählt Takumi + Termin → `POST /api/bookings` (max. 7 Tage im Voraus; `deferNotification: true`)
2. Buchung mit `paymentStatus: unpaid` erstellt
3. Zahlung: Stripe Embedded Checkout (Hold) oder `POST /api/bookings/[id]/pay-with-wallet`
4. Nach Zahlung: Webhook oder `verifySessionPayment` → `paymentStatus: paid`
5. `notifyAfterPayment` (idempotent) → E-Mail + Push an Takumi
6. Client-Fallback: `POST /api/bookings/[id]/notify-takumi`
7. Takumi: E-Mail-Link, In-App oder Geplant-Tab → `/booking/respond/[id]` (Annehmen/Ablehnen/Rückfrage)
8. Shugyo erhält E-Mail + Notification
9. Session starten (max. 5 Min vor Termin)

### Instant Connect (Shugyo wartet auf Takumi)
- **Eligibility**: Takumi muss `liveStatus = available` haben; optional `instantSlots` im Kalender
- Shugyo: `POST /api/bookings/instant` (body: `{ expertId, callType? }`) → erstellt Buchung `status: pending`, `bookingMode: instant`
- Push an Takumi: `type: BOOKING_REQUEST`, `bookingId`, `statusToken` (Quick Actions: ACCEPT/DECLINE)
- Takumi: `GET /api/expert/instant-requests` listet eingehende Anklopfer
- Accept: `GET /api/bookings/[id]/instant-accept?token=xxx` → atomic update, `liveStatus: in_call`, Redirect zu `/session/[id]?connecting=1`
- Decline: `POST /api/bookings/instant-decline` oder `PATCH /api/bookings/[id]/instant-decline?token=xxx`
- **Expiry (60s)**: Cron `/api/cron/instant-request-cleanup` markiert unbeantwortete Anfragen (`createdAt < 60s`) als `instant_expired`, released Payment (falls paid), sendet Push/Waymail an Shugyo

### Session (Daily.co)
- **Implementiert**: Daily.co Video/Voice; keine Neuimplementierung geplant
- `POST /api/daily/meeting` erstellt Raum; `DailyCallContainer` für UI
- Start: max. 5 Min vor Termin (Scheduled); Instant: sofort nach Accept
- **5-Minuten-Handshake (Case A/B)** (`lib/session-terminate.ts`, `POST /api/sessions/[id]/terminate`):
  - **Case A** (Dauer \< 5 Min): Automatische Rückerstattung / Hold-Freigabe; Status `cancelled_in_handshake`; Stripe: `cancelOrRefundPaymentIntent`, Wallet: `releaseReservation`; `paymentStatus: refunded`
  - **Case B** (Dauer ≥ 5 Min): Status `completed`; `processCompletion` → Stripe Capture / Wallet-Freigabe, Rechnung/Gutschrift, Takumi-Guthaben

### Zahlung
- **Stripe**: Hold & Capture (manual capture); **7-Tage-Hold-Fenster** (nicht 24h); Capture nach Session oder via Cron
- **Wallet**: Atomare Abzüge via `prisma.$transaction` mit Balance-Guard (`user.balance >= amountCents` vor `decrement`); `WalletTransaction`-Audit; Balance nie negativ
- **Admin Finance**: Force Capture, Manual Release mit Doppelbestätigung; Audit-Log, CSV-Export, DATEV

### Push-Benachrichtigungen
- **Web**: Web Push (VAPID) via `web-push`; `POST /api/push/subscribe` speichert `PushSubscription`; `public/sw.js` zeigt Notifications mit Quick Actions
- **Native**: Capacitor `@capacitor/push-notifications`; Token via `POST /api/push/fcm-token`; Firebase Admin für FCM
- **Quick Actions (Instant Connect)**: `BOOKING_REQUEST` mit `bookingId`, `statusToken`; Web: ACCEPT → `/api/bookings/[id]/instant-accept?token=`, DECLINE → `/api/bookings/[id]/instant-decline?token=`; Native: `pushNotificationActionPerformed` in `quick-action-push-handler.ts`
- `sendPushToUser()` versucht Web Push + FCM parallel; `lib/push.ts`, `lib/push-fcm.ts`

### Safety Enforcement
- **Automated AI-Scanning**: Google Vision API (SafeSearch) prüft Bildinhalte; `lib/vision-safety.ts`; Kategorien: adult, violence, racy (LIKELY/VERY_LIKELY = Verstoß)
- **Live-Monitoring**: `DailyCallContainer` sendet zufällige Snapshots (45–90s Intervall) an `POST /api/safety/snapshot`; nur bei Video + Safety-Einwilligung; bei Verstoß: Blob speichern, `SafetyIncident` erstellen, `setTransactionOnHoldForBooking`
- **Manueller Report**: Notfall-Button im Call unterbricht und meldet; Admin prüft unter `/admin/safety/incidents`

### Sichere Dateiübertragung
- `POST /api/files/secure-upload`: Busboy-Streaming, Cloudmersive-Virenscan (optional), Vercel Blob
- Für Chat (CHAT vs MAIL/Waymail) und Projektdateien

---

## API-Übersicht

### Auth & Nutzer
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/auth/[...nextauth]` | * | NextAuth (Credentials, JWT) |
| `/api/auth/register` | POST | Registrierung |
| `/api/auth/forgot-password` | POST | Passwort vergessen |
| `/api/auth/reset-password` | POST | Passwort zurücksetzen |
| `/api/auth/seed-admin` | POST | Admin anlegen (Dev) |
| `/api/auth/heartbeat` | POST | Session-Liveness |
| `/api/user/profile` | GET, PATCH | Profil |
| `/api/user/profile-preview` | GET | Profil-Vorschau |
| `/api/user/account` | PATCH | Konto |
| `/api/user/favorites` | GET, PATCH | Favoriten |
| `/api/user/balance` | GET | Guthaben |
| `/api/user/takumi-profile` | GET | Takumi-Profil des Users |
| `/api/users/[id]` | GET | Öffentliches Profil |

### Buchungen
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/bookings` | GET, POST | Liste, Erstellen |
| `/api/bookings?view=takumi\|shugyo` | GET | Gefilterte Buchungen |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Detail, Aktionen (start/end-session, cancel, etc.) |
| `/api/bookings/[id]/pay-with-wallet` | POST | Zahlung mit Wallet (atomar) |
| `/api/bookings/[id]/notify-takumi` | POST | Takumi nach Zahlung benachrichtigen |
| `/api/bookings/[id]/status` | GET | Buchungsstatus |
| `/api/bookings/[id]/instant-accept` | GET | Accept via token (Quick Action) |
| `/api/bookings/[id]/instant-decline` | PATCH | Decline (token in Query/Body) |
| `/api/bookings/slots` | GET | Verfügbare Slots |
| `/api/bookings/instant` | POST | Instant Connect anfordern |
| `/api/bookings/instant-check` | GET | Verfügbarkeit für Instant prüfen |
| `/api/bookings/instant-decline` | POST | Instant ablehnen (Bulk) |
| `/api/bookings/instant-accept` | POST | Instant annehmen (Body) |
| `/api/booking-respond/[id]` | GET, POST | Bestätigen/Ablehnen/Rückfrage |
| `/api/availability` | GET, PATCH | Verfügbarkeit (Takumi) |

### Session
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/daily/meeting` | POST | Daily.co Meeting-Raum erstellen |
| `/api/sessions/[id]/terminate` | POST | Session beenden (Case A/B) |
| `/api/safety/snapshot` | POST | Live-Monitoring Snapshot (Vision API) |

### Expert
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/expert/me` | GET | Experten-Datensatz (liveStatus, lastSeenAt) |
| `/api/expert/live-status` | GET, PATCH | liveStatus: offline/available/in_call/busy |
| `/api/expert/instant-requests` | GET | Eingehende Instant-Anfragen |
| `/api/expert/heartbeat` | POST | Liveness (hält liveStatus=available) |

### Zahlung & Wallet
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/wallet/history` | GET | Transaktionshistorie |
| `/api/wallet/topup` | POST | Wallet aufladen (Stripe Session) |
| `/api/wallet/topup/confirm` | POST | Topup bestätigen |
| `/api/webhooks/stripe` | POST | checkout.session.completed, payment_intent.* |
| `/api/billing/download/[transactionId]` | GET | Rechnung/CreditNote als PDF |

### Push & Notifications
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/push/subscribe` | POST | Web-Push-Abonnement speichern |
| `/api/push/fcm-token` | POST | FCM/APNs Token (native) |
| `/api/notifications` | GET, PATCH, DELETE | In-App-Notifications |
| `/api/messages` | GET, POST, PATCH | Chat, Waymails |
| `/api/messages/recipient-id` | GET | Recipient ID für Chat |

### Dateien
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/upload` | POST | Bild-Upload (Profil, AI-Guide; Vision Pre-Check) |
| `/api/files/secure-upload` | POST | Sichere Uploads mit Cloudmersive-Virenscan |

### Chat, AI, Takumis
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/chat` | POST | AI-Chat (diAIway intelligence) |
| `/api/takumis` | GET, POST | Takumi-Liste, Seed |
| `/api/takumis/seed` | POST | Seed Takumis |
| `/api/takumi/portfolio` | GET, POST | Portfolio |
| `/api/takumi/portfolio/[id]` | GET, PATCH, DELETE | Portfolio-Eintrag |
| `/api/takumi/presence` | GET | Präsenz |
| `/api/shugyo/projects` | GET, POST | Shugyo-Projekte |
| `/api/shugyo/projects/[id]` | GET, PATCH, DELETE | Projekt |

### Admin
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/admin/stats` | GET | Statistiken |
| `/api/admin/verify` | GET | Admin-Check |
| `/api/admin/users` | GET | Nutzer-Liste |
| `/api/admin/users/[id]` | GET, PATCH | Nutzer-Detail |
| `/api/admin/users/[id]/profile` | GET, PATCH | Nutzer-Profil |
| `/api/admin/bookings` | GET | Buchungsübersicht |
| `/api/admin/reset-db` | POST | DB zurücksetzen (Dev) |
| `/api/admin/templates` | GET, POST | Kommunikations-Templates |
| `/api/admin/templates/[id]` | GET, PATCH | Template |
| `/api/admin/safety` | GET | Safety-Overview |
| `/api/admin/safety/incidents` | GET | Incidents-Liste |
| `/api/admin/safety/incidents/[id]` | GET, PATCH | Incident |

### Admin Finance
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/admin/finance` | GET | Finance-Dashboard (KPIs) |
| `/api/admin/finance/summary` | GET | Escrow, Holds, Stripe-Expiry |
| `/api/admin/finance/force-capture` | POST | Stripe Hold manuell capturen |
| `/api/admin/finance/manual-release` | POST | Hold manuell freigeben |
| `/api/admin/finance/process-release` | POST | Pending Release verarbeiten |
| `/api/admin/finance/pending-releases` | GET | Pending Releases |
| `/api/admin/finance/refund` | POST | Refund |
| `/api/admin/finance/audit-log` | GET | Transaction-Audit-Log |
| `/api/admin/finance/export` | GET | CSV (format=csv), ZIP (PDFs) |
| `/api/admin/finance/datev` | GET | DATEV-Export |
| `/api/admin/finance/resend-invoice` | POST | Rechnung erneut senden |
| `/api/admin/wallet/refund` | POST | Wallet-Refund |

### Cron (Bearer CRON_SECRET)
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/cron/release-wallet` | GET | 24h nach Session: processPendingCompletions |
| `/api/cron/experts-offline` | GET | Experten nach Inaktivität → liveStatus: offline |
| `/api/cron/daily-ghost-sessions` | GET | Ghost-Sessions terminieren |
| `/api/cron/instant-request-cleanup` | GET | Instant-Anfragen älter 60s → instant_expired, Release, Push/Waymail |

### Sonstige
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/health` | GET | Health-Check |
| `/api/test/*` | - | E2E/Dev-Endpoints |

---

## Mobile Readiness (Capacitor 8)

### Status
- **Capacitor 8** ist integriert; `ios/` und `android/` enthalten native Projekte
- Hybrid-App ist produktiv; keine Migration mehr nötig

### Plugins (in Produktion)
| Plugin | Verwendung |
|--------|------------|
| `@capacitor/app` | Lifecycle, Deep-Links, `getLaunchUrl()` |
| `@capacitor/camera` | Foto-Capture |
| `@capacitor/haptics` | Haptisches Feedback (Quick Action: `hapticHeavy`) |
| `@capacitor/local-notifications` | Lokale Benachrichtigungen |
| `@capacitor/network` | Netzwerkstatus |
| `@capacitor/preferences` | Key-Value-Speicher |
| `@capacitor/push-notifications` | FCM/APNs-Token, Quick Action Listener |
| `@capacitor/share` | System-Share |
| `@capacitor/splash-screen` | Splash-Screen |
| `capacitor-native-biometric` | Biometrische Authentifizierung (optional) |

### Quick Action Push (Instant Connect)
- **Web**: `public/sw.js` – `notificationclick` mit actions ACCEPT/DECLINE; Redirect zu `/api/bookings/[id]/instant-accept|instant-decline?token=`
- **Native**: `lib/quick-action-push-handler.ts` – `pushNotificationActionPerformed`; `QuickActionPushProvider` in `app/layout.tsx`; Channel `BOOKING_REQUEST` (Android)
- Haptics bei Accept: `hapticHeavy()` aus `native-utils.ts`

### Deep-Linking
- **Native**: `App.getLaunchUrl()` in `deep-link-handler.tsx` ausgewertet
- **Web**: `callbackUrl` nach Login für Waymail-Links (`/messages?waymail={id}`)

### Permissions
- Camera: Berechtigungsabfrage bei Nutzung
- Push: Registrierung über `PushNotificationProvider` / `use-native-bridge`

### Relevante Dateien
- `capacitor.config.ts`
- `components/deep-link-handler.tsx`
- `components/splash-screen-hider.tsx`
- `components/native-test-center.tsx`
- `hooks/use-native-bridge.ts`
- `lib/native-utils.ts`
- `lib/offline-cache.ts`

---

## Sicherheit

- **Rate-Limiting**: Auth-Endpoints (Register, Login, Forgot-Password)
- **Honeypot**: Anti-Bot bei Formularen
- **Security-Headers**: X-Frame-Options, HSTS, etc. (middleware.ts)
- **DSGVO**: Konto löschen anonymisiert Buchungen, löscht Reviews
- **Safety Enforcement**: Vision API, Vercel Blob für Incidents
- **Secure Upload**: Cloudmersive-Virenscan, Streaming-Uploads

---

## Geschäftsregeln (Kurz)

| Regel | Implementierung |
|-------|------------------|
| Buchungsfenster | Max. 7 Tage im Voraus (`lib/booking-date-validation.ts`) |
| 7-Tage-Stripe-Hold | Stripe Hold verfällt nach 7 Tagen; `STRIPE_HOLD_DAYS` in `admin/finance/summary` |
| 5-Min-Handshake | Case A: \< 5 Min → Release (cancelled_in_handshake); Case B: ≥ 5 Min → Capture |
| Atomic Wallet | `balance >= amountCents` vor `decrement`; nie negativ; `WalletTransaction`-Audit |
| Instant Cleanup | 60s ohne Takumi-Antwort → `instant_expired`, Payment-Release, Push/Waymail |
| Wallet-Release-Cron | 24h nach Session-Ende: `processPendingCompletions` (Capture, Rechnung, Takumi-Guthaben) |
| AdminActionLog | Alle Admin-Aktionen (force_capture, manual_release, etc.) |
| DirectMessage | `communicationType`: CHAT vs MAIL (Waymail) |

---

*Letzte Aktualisierung: März 2026*

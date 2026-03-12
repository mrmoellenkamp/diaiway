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
| Video/Voice | Daily.co |
| Mobile | Capacitor 8 (ios/, android/) |
| Push | web-push (VAPID), @capacitor/push-notifications |
| Storage | Vercel Blob |
| AI | Vercel AI SDK (Gemini) |

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

### Instant Connect (ohne Buchung)
- Shugyo: `POST /api/bookings/instant` → findet verfügbare Takumis (`liveStatus = available`)
- `GET /api/bookings/instant-check` prüft Verfügbarkeit
- Takumi: `PATCH /api/expert/live-status` (`offline` | `available` | `in_call` | `busy`)
- Takumi: `GET /api/expert/instant-requests` für eingehende Anklopfer
- Buchung mit `bookingMode: instant` + direkte Session

### Session (Daily.co)
- **Implementiert**: Daily.co Video/Voice; keine Neuimplementierung geplant
- `POST /api/daily/meeting` erstellt Raum; `DailyCallContainer` für UI
- Start: max. 5 Min vor Termin
- **Handshake-Regel (5 Min)**:
  - **&lt; 5 Min** („Handshake“): Automatische Rückerstattung / Hold-Freigabe; Status `cancelled_in_handshake`
  - **≥ 5 Min**: Zahlungsdialog (Stripe oder Wallet) → Capture / Wallet-Freigabe
- Terminierung: `POST /api/sessions/[id]/terminate` mit `HANDSHAKE_LIMIT_MS = 5 * 60 * 1000`

### Zahlung
- **Stripe**: Hold & Capture (manual capture); Capture nach Session oder via Cron (7 Tage Expiry)
- **Wallet**: Atomare Abzüge via `updateMany` mit `balance >= amount` + `decrement`; `WalletTransaction`-Audit
- **Admin Finance**: Force Capture, Manual Release mit Doppelbestätigung; Audit-Log, CSV-Export

### Push-Benachrichtigungen
- **Web**: Web Push (VAPID) via `web-push`; `POST /api/push/subscribe` speichert `PushSubscription`
- **Native**: Capacitor `@capacitor/push-notifications`; Token für FCM/APNs
- `sendPushToUser()` aus: booking-respond, notification-service, messages, bookings
- `PushNotificationProvider` registriert Service Worker und subscribes Nutzer

### Safety Enforcement
- Live-Monitoring: Zufällige Snapshots; Verstöße → Vercel Blob
- Admin: `/admin/safety/incidents` zeigt Alert-Bilder
- Vision API optional für Bildanalyse

### Sichere Dateiübertragung
- `POST /api/files/secure-upload`: Busboy-Streaming, Cloudmersive-Virenscan (optional), Vercel Blob
- Für Chat (CHAT vs MAIL/Waymail) und Projektdateien

---

## API-Übersicht

### Auth & Nutzer
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/auth/*` | - | NextAuth, Register, Forgot-Password, Reset-Password, Seed-Admin |
| `/api/user/*` | - | Profil, Takumi-Profil, Account, Favoriten, Balance |
| `/api/users/[id]` | GET | Öffentliches Profil |

### Buchungen
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/bookings` | GET, POST | Liste, Erstellen |
| `/api/bookings?view=takumi\|shugyo` | GET | Gefilterte Buchungen |
| `/api/bookings/[id]` | GET, PATCH, DELETE | Detail, start/end-session, cancel |
| `/api/bookings/[id]/pay-with-wallet` | POST | Zahlung mit Wallet (atomar) |
| `/api/bookings/[id]/notify-takumi` | POST | Takumi nach Zahlung benachrichtigen |
| `/api/bookings/[id]/status` | GET | Buchungsstatus |
| `/api/bookings/slots` | GET | Verfügbare Slots |
| `/api/bookings/instant` | POST | Instant Connect anfordern |
| `/api/bookings/instant-check` | GET | Verfügbarkeit für Instant prüfen |
| `/api/booking-respond/[id]` | GET, POST | Bestätigen/Ablehnen/Rückfrage |
| `/api/availability` | GET, PATCH | Verfügbarkeit (Takumi) |

### Session
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/daily/meeting` | POST | Daily.co Meeting-Raum erstellen |
| `/api/sessions/[id]/terminate` | POST | Session beenden (Handshake vs Capture) |

### Expert
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/expert/live-status` | PATCH | offline/available/in_call/busy |
| `/api/expert/instant-requests` | GET | Eingehende Instant-Anfragen |
| `/api/expert/heartbeat` | POST | Liveness-Signal |

### Zahlung & Wallet
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/wallet/history` | GET | Transaktionshistorie |
| `/api/wallet/topup` | POST | Wallet aufladen (Stripe) |
| `/api/webhooks/stripe` | POST | checkout.session.completed, payment_intent.* |
| `/api/billing/download/[transactionId]` | GET | Rechnung als PDF |

### Push & Notifications
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/push/subscribe` | POST | Web-Push-Abonnement speichern |
| `/api/notifications` | GET, PATCH, DELETE | In-App-Notifications |

### Dateien
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/upload` | POST | Bild-Upload (Profil, AI-Guide) |
| `/api/files/secure-upload` | POST | Sichere Uploads mit Virenscan |

### Chat & AI
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/chat` | POST | AI-Chat (diAIway intelligence) |
| `/api/takumis` | GET, POST | Takumi-Liste, Seed |

### Admin
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/admin/stats` | GET | Statistiken |
| `/api/admin/users`, `/api/admin/users/[id]` | GET, PATCH | Nutzerverwaltung |
| `/api/admin/bookings` | GET | Buchungsübersicht |
| `/api/admin/finance` | GET | Finance-Dashboard-Daten |
| `/api/admin/finance/summary` | GET | Escrow-Übersicht |
| `/api/admin/finance/force-capture` | POST | Stripe Hold manuell capturen |
| `/api/admin/finance/manual-release` | POST | Hold manuell freigeben |
| `/api/admin/finance/audit-log` | GET | Transaction-Audit-Log |
| `/api/admin/finance/export` | GET | CSV (format=csv), ZIP (PDFs), DATEV |
| `/api/admin/finance/pending-releases` | GET | Pending Releases |
| `/api/admin/finance/process-release` | POST | Release verarbeiten |
| `/api/admin/finance/refund` | POST | Refund |
| `/api/admin/safety`, `/api/admin/safety/incidents` | GET | Safety Incidents |
| `/api/admin/reset-db` | POST | DB zurücksetzen (Dev) |

### Cron
| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/cron/release-wallet` | GET | 24h-Wallet-Freigabe (Bearer CRON_SECRET) |
| `/api/cron/experts-offline` | GET | Experten nach Inaktivität offline setzen |

---

## Mobile Readiness (Capacitor)

### Status
- **Capacitor 8** ist integriert; `ios/` und `android/` enthalten native Projekte
- Keine Migration mehr nötig – Hybrid-App ist produktiv

### Plugins (bereits implementiert)
| Plugin | Verwendung |
|--------|------------|
| `@capacitor/camera` | Foto-Capture |
| `@capacitor/push-notifications` | FCM/APNs-Token |
| `@capacitor/local-notifications` | Lokale Benachrichtigungen |
| `@capacitor/haptics` | Haptisches Feedback |
| `@capacitor/network` | Netzwerkstatus |
| `@capacitor/preferences` | Key-Value-Speicher |
| `@capacitor/share` | System-Share |
| `@capacitor/splash-screen` | Splash-Screen |
| `@capacitor/app` | Lifecycle, Deep-Links |
| `capacitor-native-biometric` | Biometrie (optional) |

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
| Handshake | &lt; 5 Min → Release; ≥ 5 Min → Capture |
| Stripe-Expiry | 7 Tage (nicht 24h) |
| Wallet-Freigabe | 24h nach Session via Cron |
| AdminActionLog | Alle Admin-Aktionen (force_capture, manual_release, etc.) |
| DirectMessage | `communicationType`: CHAT vs MAIL (Waymail) |

---

*Letzte Aktualisierung: März 2026*

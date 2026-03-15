# Production Pre-Flight Audit

**Date:** March 2026  
**Scope:** Variable validation, Cron security, Deep-link verification, Daily.co webhook

---

## 1. Variable Validation

### Server-Side `process.env` Usage

| Variable | Usage | Status |
|----------|-------|--------|
| `CRON_SECRET` | All cron routes | ✅ Required; 503 if missing |
| `DAILY_WEBHOOK_SECRET` | `/api/webhooks/daily` | ✅ **Fixed:** Now 503 in production if unset |
| `FIREBASE_SERVICE_ACCOUNT_JSON` / `GOOGLE_APPLICATION_CREDENTIALS` | `lib/push-fcm.ts` | ✅ Graceful: returns null if unset; Push falls back to Web Push |
| `GOOGLE_CLOUD_VISION_API_KEY` | `lib/vision-safety.ts` | ✅ Graceful: returns "Bildprüfung nicht konfiguriert" |
| `CLOUDMERSIVE_API_KEY` | `app/api/files/secure-upload` | ✅ Optional: skips virus scan if unset |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `lib/push.ts` | ✅ Graceful: skips Web Push if unset |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `lib/stripe.ts`, webhooks | ✅ Required at runtime |
| `DAILY_API_KEY` | `app/api/daily/meeting` | ✅ Returns 500 if missing |

### Hardcoded Keys

- **None found.** No `sk_test`, `pk_test`, `sk_live`, `pk_live`, or API keys in source.
- `.env.example` uses placeholders (`sk_test_...`, `pk_test_...`) only.

### Fallback URLs

- `NEXTAUTH_URL` fallbacks use `https://diaiway.com` (production domain) or `VERCEL_URL`; acceptable.

---

## 2. Cron Security

All 5 cron routes enforce `Authorization: Bearer <CRON_SECRET>`:

| Route | Auth Check | Status |
|-------|------------|--------|
| `/api/cron/release-wallet` | `CRON_SECRET` + `Bearer` | ✅ |
| `/api/cron/experts-offline` | `CRON_SECRET` + `Bearer` (GET & POST) | ✅ |
| `/api/cron/instant-request-cleanup` | `CRON_SECRET` + `Bearer` | ✅ |
| `/api/cron/daily-ghost-sessions` | `CRON_SECRET` or `DAILY_GHOST_SECRET` + `Bearer` | ✅ |
| `/api/cron/cleanup-safety-data` | `CRON_SECRET` + `Bearer` | ✅ |

- Missing `CRON_SECRET` → 503
- Wrong or missing header → 401

**Action:** Ensure `CRON_SECRET` is set in production and Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.

---

## 3. Deep-Link Verification

### Implementation (`components/deep-link-handler.tsx`)

- Uses `App.getLaunchUrl()` and `appUrlOpen` (Capacitor native only).
- Parses URL: `path = parsed.pathname + parsed.search` → preserves `/messages?waymail=123`.
- Hostname check: `parsed.hostname.includes("diaiway.com")` → matches `diaiway.com`, `www.diaiway.com`.
- `router.push(path)` navigates to target.

### Waymail Flow (Authenticated)

1. User taps `diaiway.com/messages?waymail=123`.
2. App opens → `getLaunchUrl()` returns full URL.
3. `navigateToUrl` → `router.push("/messages?waymail=123")`.
4. Middleware: if not logged in → redirect to `/login?callbackUrl=/messages%3Fwaymail%3D123`.
5. After login: `window.location.href = explicitCallback` → `/messages?waymail=123`.
6. Messages page reads `searchParams.get("waymail")` → shows Waymail.

### Middleware (`middleware.ts` Line 76–85)

- `callbackUrl = pathname + req.nextUrl.search` → preserves `?waymail=` and `?with=` for chat.

**Status:** ✅ Deep-link handler and middleware correctly preserve Waymail/Chat query params for post-login redirect.

---

## 4. Daily.co Webhook

### Endpoint: `POST /api/webhooks/daily`

**Events handled:**

| Event | Action |
|-------|--------|
| `participant.left` | Inserts `DailyParticipantLeft` (room, sessionId) |
| `participant.joined` | Cancels recent `participant.left` within 65s (rejoin) |
| `meeting.ended` | Calls `terminateSessionForBooking(bookingId)` |

### 60s Ghost Logic

- **Webhook** records `participant.left`; does not terminate.
- **Cron** `/api/cron/daily-ghost-sessions` (every run, e.g. 5 min):
  - Finds `DailyParticipantLeft` where `leftAt < now - 60s` and `cancelledAt = null`.
  - Calls `terminateSessionForBooking(bookingId)` (Case A/B).
- **Flow:** participant.left → stored → no rejoin within 60s → cron terminates session.

### Security (Updated)

- **Before:** If `DAILY_WEBHOOK_SECRET` was unset, webhook accepted any request.
- **After:** In production, returns 503 if `DAILY_WEBHOOK_SECRET` is not set.
- Signature: `x-webhook-signature` or `x-daily-signature`; verified via HMAC-SHA256.

**Action:** Set `DAILY_WEBHOOK_SECRET` in production and configure it in Daily.co dashboard.

---

## Checklist Before Go-Live

- [ ] `CRON_SECRET` set; Vercel Cron uses `Authorization: Bearer <CRON_SECRET>`
- [ ] `DAILY_WEBHOOK_SECRET` set; Daily.co webhook URL and secret configured
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (production keys)
- [ ] `NEXTAUTH_URL` = production URL
- [ ] Optional: `FIREBASE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CLOUD_VISION_API_KEY`, `CLOUDMERSIVE_API_KEY` for full functionality

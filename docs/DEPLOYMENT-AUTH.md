# Auth & Login in Produktion (Safari / iOS / Vercel)

Diese Checkliste verhindert typische Probleme: **Session-Cookie stimmt nicht mit der Adresszeile überein**, WebKit (Safari, alle Browser auf iOS) zeigt nach Login noch „Abgemeldet“.

## 1. Kanonische URL

**Festgelegt im Projekt:** `https://diaiway.com` (ohne `www`).

- `next.config.mjs` leitet **`www.diaiway.com` → `https://diaiway.com`** (301) um.
- Pay-Links und ähnliche URLs im Code nutzen **`https://diaiway.com`**.

**Deine Aufgabe am DNS/Vercel:** Sicherstellen, dass beide Hostnamen auf Vercel zeigen; die App erzwingt dann Apex.

## 2. Vercel – Environment Variables (Production)

| Variable | Wert (Beispiel) | Hinweis |
|----------|------------------|---------|
| `NEXTAUTH_URL` | `https://diaiway.com` | **Exakt** die kanonische URL, mit `https://`, **ohne** trailing `/` |
| `NEXTAUTH_SECRET` | min. 32 Zeichen zufällig | Niemals committen |

Optional (Auth.js v5 erkennt teils auch):

- `AUTH_URL` = gleicher Wert wie `NEXTAUTH_URL` (falls ihr laut Doku beides setzt)
- `AUTH_SECRET` = gleicher Wert wie `NEXTAUTH_SECRET`

Nach Änderungen: **Production neu deployen**.

## 3. Was der Code bereits macht

- **`trustHost: true`** in `lib/auth.ts` und `lib/auth-edge.ts` — korrekte Host-Erkennung hinter Vercel (Proxy-Header).
- Nach Credentials-Login: **`getSession()`** (NextAuth-Client synchronisieren).
- Safari / iOS-Browser (nicht native Capacitor-Shell): **harter Seitenwechsel** nach Login (`window.location.assign`), siehe `lib/browser-auth-nav.ts`.

## 4. Was Nutzer nicht tun müssen

Keine Safari-Einstellungen ändern. Wenn es nach 1–2 dennoch hakt, liegt es fast immer an **falscher `NEXTAUTH_URL`**, **Preview-URL** (`.vercel.app`) statt Custom Domain, oder **altem Tab** mit anderem Host — dann einmal Tab schließen und **`https://diaiway.com`** neu öffnen.

## 5. Kurztest nach Deploy

1. Safari (Mac oder iPhone), **nicht** privates Fenster.  
2. URL: `https://diaiway.com/login`  
3. Einloggen → Profil/Avatar sichtbar, keine dauerhafte „Anmelden“-Schleife.  
4. Optional: Web-Inspektor → Netzwerk → POST `callback/credentials` → Response-Header **`Set-Cookie`** vorhanden.

## 6. Mobile App (Capacitor)

`capacitor.config.ts`: `server.url` ist auf **`https://diaiway.com`** gesetzt; `www` bleibt in `allowNavigation`, damit alte Links funktionieren. Native Shell ist **kein** Safari-Tab — bei Problemen dort separat WebView/Cookies prüfen.

---

Siehe auch: [`ENV.md`](./ENV.md), [`.env.example`](../.env.example).

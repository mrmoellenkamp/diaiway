import { NextResponse } from "next/server"
import { authMiddleware } from "@/lib/auth-edge"
import { INACTIVITY_TIMEOUT_SEC, LAST_ACTIVITY_COOKIE } from "@/lib/session-activity"

/** Kein HSTS auf localhost / LAN — sonst können Browser oder Auth-Callbacks „hängen“ oder zu HTTPS wechseln. */
function isLocalDevHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h.endsWith(".local") ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)
  )
}

/**
 * Edge-safe nonce generator.
 * Node's crypto ist in der Edge-Runtime nicht garantiert verfügbar — deshalb
 * Web Crypto API (globalThis.crypto). Base64-encoded 16 Bytes.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export default authMiddleware((req) => {
  // CORS: OPTIONS (Preflight) darf nicht mit 307 redirected werden – sonst Fehler "Preflight response is not successful"
  if (req.method === "OPTIONS") {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Android App Links: /.well-known/* muss unter www ohne Redirect erreichbar sein (Vercel wendet
  // next.config redirects vor Middleware an — daher www→Apex nur hier, nach dieser Ausnahme).
  if (pathname.startsWith("/.well-known")) {
    return NextResponse.next()
  }

  const hostname = req.nextUrl.hostname.toLowerCase()
  if (hostname === "www.diaiway.com") {
    const apex = req.nextUrl.clone()
    apex.hostname = "diaiway.com"
    apex.protocol = "https:"
    return NextResponse.redirect(apex, 308)
  }

  const token = req.auth
  const isLoggedIn = !!token?.user
  const role   = (token?.user as { role?: string })?.role   || "user"
  const appRole = (token?.user as { appRole?: string })?.appRole || "shugyo"
  const status = (token?.user as { status?: string })?.status || "active"
  const emailConfirmedAt = (token?.user as { emailConfirmedAt?: number | null })?.emailConfirmedAt ?? null
  const isEmailVerified = !!emailConfirmedAt

  // ── E-Mail-Verifizierung (Double Opt-In) ───────────────────────────────────
  // Ohne bestätigte E-Mail: nur /verify-email, /login, /api/auth, öffentliche Seiten
  const allowedWithoutVerification = [
    "/verify-email",
    "/verify-email/success",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/legal",
    "/how-it-works",
    "/categories",
    "/takumis",
    "/search",
    "/ai-guide",
    "/help",
    "/booking/respond",
    "/beta",
  ]
  const isAllowedWithoutVerification =
    allowedWithoutVerification.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/takumi/")

  if (isLoggedIn && !isEmailVerified && !isAllowedWithoutVerification) {
    return NextResponse.redirect(new URL("/verify-email", req.url))
  }

  // ── Inactivity Lockout (15 min) ───────────────────────────────────────────
  // Heartbeat bypasses expiry so user can extend session from warning modal
  // "Stay logged in" (diaiway_stay=1) bypasses timeout – user chose to stay logged in on mobile
  const isHeartbeat = pathname === "/api/auth/heartbeat"
  const stayLoggedIn = req.cookies.get("diaiway_stay")?.value === "1"
  if (isLoggedIn && !isHeartbeat && !stayLoggedIn) {
    const lastActivity = req.cookies.get(LAST_ACTIVITY_COOKIE)?.value
    const lastTs = lastActivity ? parseInt(lastActivity, 10) : 0
    const now = Math.floor(Date.now() / 1000)
    const elapsed = now - lastTs

    if (lastTs > 0 && elapsed >= INACTIVITY_TIMEOUT_SEC) {
      // Session expired — clear auth cookie and redirect
      const redirect = NextResponse.redirect(new URL("/login?reason=timeout", req.url))
      const secure = req.nextUrl.protocol === "https:"
      redirect.cookies.set(LAST_ACTIVITY_COOKIE, "", { maxAge: 0, path: "/" })
      redirect.cookies.set("authjs.session-token", "", { maxAge: 0, path: "/" })
      if (secure) redirect.cookies.set("__Secure-authjs.session-token", "", { maxAge: 0, path: "/" })
      return redirect
    }
  }

  // Paused accounts — block all app routes except /paused and auth routes
  if (
    isLoggedIn &&
    status === "paused" &&
    !pathname.startsWith("/paused") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/user/account")
  ) {
    return NextResponse.redirect(new URL("/paused", req.url))
  }

  // Admin: nur Login-Pflicht hier. Rollen-Check NICHT im JWT/Middleware — Edge-Auth hat keinen DB-Sync;
  // sonst Admins mit frischem Token aus DB, aber altem JWT (z. B. Rolle kürzlich geändert) → Redirect /home.
  // `app/(app)/admin/layout.tsx` prüft role gegen DB via `auth()` + Prisma.
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/admin", req.url))
    }
  }

  // Verfügbarkeit — only takumi (appRole) and admin (role)
  if (pathname.startsWith("/profile/availability")) {
    if (!isLoggedIn)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      )
    if (appRole !== "takumi" && role !== "admin")
      return NextResponse.redirect(new URL("/home", req.url))
  }

  // Takumi Portfolio — alle eingeloggten Nutzer (Projekte bleiben bei Rollenwechsel erhalten)
  if (pathname.startsWith("/dashboard/takumi")) {
    if (!isLoggedIn)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      )
  }

  // Protected app pages — any logged-in user (except /booking/respond which uses token from email)
  // callbackUrl = pathname + search → Deep-Links (waymail=, with= für Chat) bleiben nach Login erhalten
  const isBookingRespond = pathname.startsWith("/booking/respond")
  // Guest call route: accessible without login (guest pays & joins without an account)
  const isGuestCall = pathname.startsWith("/call/")
  if (!isBookingRespond && !isGuestCall) {
    const protectedPrefixes = ["/dashboard", "/profile", "/booking", "/sessions", "/session", "/messages"]
    for (const prefix of protectedPrefixes) {
      if (pathname.startsWith(prefix) && !isLoggedIn) {
        const callbackUrl = pathname + req.nextUrl.search
        return NextResponse.redirect(
          new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url)
        )
      }
    }
  }

  // ── CSP Nonce (pro Request) ────────────────────────────────────────────────
  // 16 Bytes Zufallsdaten → base64. Wird via Request-Header an Pages durchgereicht,
  // damit `next/headers` in Server-Components auf die aktuelle Nonce zugreifen kann
  // (Doku: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
  const nonce = generateNonce()

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Update lastActivity cookie on each valid request (keeps 15-min timer alive)
  if (isLoggedIn) {
    const now = Math.floor(Date.now() / 1000).toString()
    response.cookies.set(LAST_ACTIVITY_COOKIE, now, {
      path: "/",
      maxAge: INACTIVITY_TIMEOUT_SEC + 60, // Slightly longer than timeout
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      httpOnly: true,
    })
  }

  // ── No-cache for protected pages — prevents browser back-button from showing stale content ──
  const protectedPrefixes = ["/dashboard", "/profile", "/booking", "/sessions", "/session", "/messages", "/admin"]
  if (protectedPrefixes.some((p) => pathname.startsWith(p))) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
  }

  // ── Security headers ──────────────────────────────────────────────────────
  // PDF-Vorschau im Admin: iframe src = dieselbe Origin → DENY blockiert die Einbettung komplett
  const isInvoicePdfPreviewApi = pathname === "/api/admin/invoice-branding/preview"
  response.headers.set("X-Frame-Options", isInvoicePdfPreviewApi ? "SAMEORIGIN" : "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  // X-XSS-Protection ist veraltet und kann in manchen Browsern XSS-Lücken öffnen;
  // moderne Browser setzen ausschließlich auf CSP. Deshalb explizit deaktivieren.
  response.headers.set("X-XSS-Protection", "0")
  // CSP mit Nonce + strict-dynamic (CSP Level 3):
  //  - 'unsafe-eval' entfernt (XSS-Härtung).
  //  - 'unsafe-inline' bleibt als Fallback für ältere Browser, wird aber von
  //    Browsern mit nonce/strict-dynamic ignoriert (spec-konform).
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' blob: https://js.stripe.com https://connect-js.stripe.com https://vercel.live https://*.vercel.app; script-src-elem 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://js.stripe.com https://connect-js.stripe.com https://vercel.live https://*.vercel.app; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.vercel.app; img-src 'self' data: blob: https:; connect-src 'self' https://api.stripe.com https://*.stripe.com https://connect-js.stripe.com https://*.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com https://*.daily.co wss://*.daily.co https://vercel.live https://*.vercel.app wss:; frame-src 'self' https://js.stripe.com https://connect-js.stripe.com https://checkout.stripe.com https://*.stripe.com https://*.daily.co https://vercel.live https://*.vercel.app; font-src 'self' data: https://fonts.gstatic.com https://*.vercel.app; media-src 'self' blob: https://*.daily.co; worker-src 'self' blob:; base-uri 'self'; form-action 'self' https://checkout.stripe.com; object-src 'none'; frame-ancestors 'none';`
  )
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), payment=(self)"
  )
  // HSTS nur unter echtem HTTPS und nicht auf Dev-Hosts (nie auf http://localhost senden)
  const host = req.nextUrl.hostname
  if (req.nextUrl.protocol === "https:" && !isLocalDevHost(host)) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    )
  }

  return response
})

export const config = {
  matcher: [
    // Immer vor Auth: Digital Asset Links (auch www ohne Redirect)
    "/.well-known/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/dashboard/:path*",
    "/booking/:path*",
    "/sessions/:path*",
    "/session/:path*",
    "/messages",        // Waymail/Chat: nur mit Login zugänglich
    "/messages/:path*",
    "/api/auth/heartbeat",
    // Apply security headers to all non-static routes
    "/((?!_next/static|_next/image|favicon.ico|images/|icon|apple-icon|manifest).*)",
  ],
}

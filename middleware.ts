import { NextResponse } from "next/server"
import { authMiddleware } from "@/lib/auth-edge"

export default authMiddleware((req) => {
  const { pathname } = req.nextUrl
  const token = req.auth
  const isLoggedIn = !!token?.user
  const role   = (token?.user as { role?: string })?.role   || "user"
  const status = (token?.user as { status?: string })?.status || "active"

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

  // Admin pages — only role: "admin"
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn)
      return NextResponse.redirect(new URL("/login?callbackUrl=/admin", req.url))
    if (role !== "admin")
      return NextResponse.redirect(new URL("/home", req.url))
  }

  // Availability dashboard — only takumi and admin
  if (pathname.startsWith("/dashboard/availability")) {
    if (!isLoggedIn)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      )
    if (role !== "takumi" && role !== "admin")
      return NextResponse.redirect(new URL("/home", req.url))
  }

  // Protected app pages — any logged-in user
  const protectedPrefixes = ["/dashboard", "/profile", "/booking", "/sessions", "/messages"]
  for (const prefix of protectedPrefixes) {
    if (pathname.startsWith(prefix) && !isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url)
      )
    }
  }

  const response = NextResponse.next()

  // ── Security headers ──────────────────────────────────────────────────────
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.daily.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.daily.co https://*.googleapis.com wss:; frame-src 'self' https://js.stripe.com https://*.daily.co; font-src 'self';"
  )
  response.headers.set(
    "Permissions-Policy",
    // Allow camera + microphone for video calls; deny everything else
    "camera=(self), microphone=(self), geolocation=(), payment=(self)"
  )
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )

  return response
})

export const config = {
  matcher: [
    "/admin/:path*",
    "/profile/:path*",
    "/dashboard/:path*",
    "/booking/:path*",
    "/sessions/:path*",
    "/messages/:path*",
    // Apply security headers to all non-static routes
    "/((?!_next/static|_next/image|favicon.ico|images/|icon|apple-icon|manifest).*)",
  ],
}

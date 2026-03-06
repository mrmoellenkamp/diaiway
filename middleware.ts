import { NextResponse } from "next/server"
import { authMiddleware } from "@/lib/auth-edge"

export default authMiddleware((req) => {
  const { pathname } = req.nextUrl
  const token = req.auth
  const isLoggedIn = !!token?.user
  const role = (token?.user as { role?: string })?.role || "user"

  // Admin pages -- only role: "admin"
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/admin", req.url))
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/home", req.url))
    }
  }

  // Dashboard pages -- any logged-in user
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL("/login?callbackUrl=" + encodeURIComponent(pathname), req.url)
      )
    }
  }

  // Profile pages -- any logged-in user
  if (pathname.startsWith("/profile")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/profile", req.url))
    }
  }

  // Booking pages -- any logged-in user
  if (pathname.startsWith("/booking")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL("/login?callbackUrl=" + encodeURIComponent(pathname), req.url)
      )
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/dashboard/:path*", "/booking/:path*"],
}

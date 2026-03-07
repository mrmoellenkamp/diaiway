import type { MetadataRoute } from "next"

/**
 * robots.txt — Block sensitive paths from search engine indexing.
 * Allows public pages; disallows /api, /admin, /dashboard, /login, /register, etc.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/login",
          "/register",
          "/signup",
          "/onboarding",
          "/reset-password/",
          "/forgot-password",
          "/paused",
          "/session/",
        ],
      },
    ],
    sitemap: process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/sitemap.xml`
      : "https://diaiway.com/sitemap.xml",
  }
}

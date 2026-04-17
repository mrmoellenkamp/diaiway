import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { assertIpRateLimit } from "@/lib/api-rate-limit"
import { safeStringCompare } from "@/lib/timing-safe"
import { logSecureError, logSecureWarn } from "@/lib/log-redact"

/**
 * POST /api/auth/seed-admin
 * Creates the first admin user. Protected by ADMIN_PASSWORD env var.
 * Will reject if an admin already exists.
 *
 * Security:
 *  - Harte IP-Rate-Limitierung (5 / Stunde) verhindert Brute-Force auf
 *    ADMIN_PASSWORD.
 *  - Konstantzeit-Vergleich des Admin-Passworts.
 */
export async function POST(req: Request) {
  const rl = await assertIpRateLimit(req, {
    bucket: "seed-admin",
    limit: 5,
    windowSec: 3600,
  })
  if (rl) return rl

  const expectedPassword = process.env.ADMIN_PASSWORD
  if (!expectedPassword?.trim()) {
    logSecureError("seed-admin", "ADMIN_PASSWORD not configured")
    return NextResponse.json({ error: "Nicht konfiguriert." }, { status: 503 })
  }
  try {
    const { password: adminPassword, name, email, userPassword } = await req.json()

    if (typeof adminPassword !== "string" || !safeStringCompare(adminPassword, expectedPassword)) {
      logSecureWarn("seed-admin", "wrong admin password")
      return NextResponse.json({ error: "Falsches Admin-Passwort." }, { status: 401 })
    }
    if (!name || !email || !userPassword) {
      return NextResponse.json(
        { error: "name, email und userPassword sind erforderlich." },
        { status: 400 }
      )
    }
    if (typeof userPassword !== "string" || userPassword.length < 12) {
      return NextResponse.json(
        { error: "userPassword muss mindestens 12 Zeichen haben." },
        { status: 400 }
      )
    }

    const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" } })
    if (existingAdmin) {
      return NextResponse.json(
        { error: "Ein Admin-Nutzer existiert bereits." },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(userPassword, 12)
    const admin = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
        password: hashed,
        role: "admin",
        appRole: "shugyo",
        favorites: [],
      },
    })

    return NextResponse.json(
      { success: true, message: `Admin '${admin.name}' (${admin.email}) erfolgreich erstellt.` },
      { status: 201 }
    )
  } catch (err: unknown) {
    logSecureError("seed-admin", err)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

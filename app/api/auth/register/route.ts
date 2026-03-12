import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { sendWelcomeWaymail } from "@/lib/onboarding"

export const runtime = "nodejs"

/** Minimum password requirements */
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Das Passwort muss mindestens 8 Zeichen lang sein."
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw))
    return "Das Passwort muss mindestens eine Zahl oder ein Sonderzeichen enthalten."
  return null
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const body = await req.json()

    // ── Honeypot ──────────────────────────────────────────────────────────────
    // Any value in the hidden _hp field = bot → return fake success immediately
    if (body._hp) {
      return NextResponse.json(
        { success: true, message: "Konto erfolgreich erstellt." },
        { status: 201 }
      )
    }

    const { name, email, password } = body

    // ── Rate limiting ─────────────────────────────────────────────────────────
    // 5 registrations per IP per 15 min
    const rlIp = rateLimit(`register:ip:${ip}`, { limit: 5, windowSec: 900 })
    if (!rlIp.success) {
      return NextResponse.json(
        { error: `Zu viele Versuche. Bitte warte ${rlIp.retryAfterSec} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(rlIp.retryAfterSec) } }
      )
    }
    // 3 registrations per email per hour (prevents email flooding)
    const rlEmail = rateLimit(`register:email:${(email || "").toLowerCase()}`, { limit: 3, windowSec: 3600 })
    if (!rlEmail.success) {
      return NextResponse.json(
        { error: `Zu viele Versuche fuer diese E-Mail. Bitte warte ${rlEmail.retryAfterSec} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(rlEmail.retryAfterSec) } }
      )
    }

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      )
    }

    const pwError = validatePassword(password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // ── Duplicate check ───────────────────────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      // Add artificial delay to prevent timing-based email enumeration
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 409 }
      )
    }

    // ── Create user ───────────────────────────────────────────────────────────
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: "user",
        appRole: "shugyo",
        favorites: [],
      },
    })

    sendWelcomeWaymail(user.id).catch(() => {})

    return NextResponse.json(
      { success: true, message: "Konto erfolgreich erstellt.", userId: user.id },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registrierungsfehler"
    console.error("[diAiway] Register error:", message)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

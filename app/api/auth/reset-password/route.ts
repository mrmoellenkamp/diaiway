import { NextResponse } from "next/server"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

/** Minimum password requirements (must match client-side validation) */
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Das Passwort muss mindestens 8 Zeichen lang sein."
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw))
    return "Das Passwort muss mindestens eine Zahl oder ein Sonderzeichen enthalten."
  return null
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token und neues Passwort sind erforderlich." },
        { status: 400 }
      )
    }

    // ── Rate limiting: 5 attempts per IP per 30 min ────────────────────────
    const rl = rateLimit(`reset:ip:${ip}`, { limit: 5, windowSec: 1800 })
    if (!rl.success) {
      return NextResponse.json(
        { error: `Zu viele Versuche. Bitte warte ${rl.retryAfterSec} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    // ── Validate password strength ─────────────────────────────────────────
    const pwError = validatePassword(password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
    }

    // ── Verify token ───────────────────────────────────────────────────────
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")
    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!user) {
      // Constant-time response to prevent timing attacks on token validity
      await bcrypt.hash("dummy", 4)
      return NextResponse.json(
        { error: "Der Link ist ungueltig oder abgelaufen. Bitte fordere einen neuen an." },
        { status: 400 }
      )
    }

    // ── Update password and invalidate token ───────────────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(password, 12),
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Dein Passwort wurde erfolgreich geaendert. Du kannst dich jetzt anmelden.",
    })
  } catch (err: unknown) {
    console.error("[diAiway] reset-password error:", err)
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 })
  }
}

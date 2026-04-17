import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
import { emailSalutationFromUser } from "@/lib/communication-display"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"

// Generic success message — never reveals whether an email exists
const SUCCESS_MSG = "Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet."

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Bitte eine E-Mail-Adresse eingeben." }, { status: 400 })
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────
    // 3 requests per IP per hour
    const rlIp = await rateLimit(`forgot:ip:${ip}`, { limit: 3, windowSec: 3600 })
    if (!rlIp.success) {
      // Return fake success to not reveal rate limit to attackers
      return NextResponse.json({ success: true, message: SUCCESS_MSG })
    }
    // 2 requests per email per hour
    const rlEmail = await rateLimit(`forgot:email:${email.toLowerCase().trim()}`, { limit: 2, windowSec: 3600 })
    if (!rlEmail.success) {
      return NextResponse.json({ success: true, message: SUCCESS_MSG })
    }

    // ── Look up user (anti-enumeration: always return 200) ────────────────────
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex")
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")
      const expiry = new Date(Date.now() + 60 * 60 * 1_000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: hashedToken, resetTokenExpiry: expiry },
      })

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

      try {
        await sendPasswordResetEmail(
          user.email,
          emailSalutationFromUser({ username: user.username, email: user.email }),
          `${baseUrl}/reset-password/${rawToken}`,
        )
      } catch (emailErr) {
        logSecureError("forgot-password.email", emailErr)
      }
    }

    return NextResponse.json({ success: true, message: SUCCESS_MSG })
  } catch (err: unknown) {
    logSecureError("forgot-password", err)
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 })
  }
}

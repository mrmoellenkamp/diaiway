import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"
import { sendVerificationEmail } from "@/lib/email"
import { communicationUsername } from "@/lib/communication-display"
import crypto from "crypto"

export const runtime = "nodejs"

const RESEND_COOLDOWN_SEC = 120 // 2 Minuten zwischen Versuchen
const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000

/**
 * POST /api/auth/resend-verification
 * Sendet die Verifizierungs-Mail erneut. Rate-Limit: 1 Request pro 2 Minuten pro User.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  if (!userId) {
    return NextResponse.json({ error: "Session ungültig." }, { status: 401 })
  }

  const rl = await rateLimit(`resend-verify:${userId}`, { limit: 1, windowSec: RESEND_COOLDOWN_SEC })
  if (!rl.success) {
    return NextResponse.json(
      {
        error: `Bitte warte ${rl.retryAfterSec} Sekunden, bevor du die E-Mail erneut anforderst.`,
        retryAfterSec: rl.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, username: true, emailConfirmedAt: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 })
    }

    if (user.emailConfirmedAt) {
      return NextResponse.json(
        { error: "Deine E-Mail ist bereits bestätigt.", alreadyVerified: true },
        { status: 400 }
      )
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + TOKEN_VALIDITY_MS)

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"
    const verifyUrl = `${baseUrl}/api/auth/verify-email/${token}`

    const result = await sendVerificationEmail({
      to: user.email,
      name: communicationUsername(user.username, user.email.split("@")[0] || "Nutzer"),
      verifyUrl,
    })

    if (!result.sent) {
      console.error("[resend-verification] Email failed:", result.error)
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Verifizierungs-Mail wurde erneut gesendet.",
      retryAfterSec: RESEND_COOLDOWN_SEC,
    })
  } catch (err) {
    console.error("[resend-verification] Error:", err)
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es später erneut." },
      { status: 500 }
    )
  }
}

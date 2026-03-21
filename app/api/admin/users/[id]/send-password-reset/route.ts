import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
import { emailSalutationFromUser } from "@/lib/communication-display"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return { error: "Nicht autorisiert." as const, status: 401 as const }
  }
  return { session }
}

/**
 * POST /api/admin/users/[id]/send-password-reset
 * Admin sendet dem Nutzer eine E-Mail zur Passwort-Erneuerung.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 })

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, username: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 })
    }

    // Anonymisierte Nutzer haben keine echte E-Mail
    if (user.email?.endsWith("@anonymized.local")) {
      return NextResponse.json({ error: "Anonymisierte Nutzer haben keine E-Mail-Adresse." }, { status: 400 })
    }

    const rawToken = crypto.randomBytes(32).toString("hex")
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiry = new Date(Date.now() + 60 * 60 * 1_000) // 1 Stunde

    await prisma.user.update({
      where: { id },
      data: { resetToken: hashedToken, resetTokenExpiry: expiry },
    })

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    await sendPasswordResetEmail(
      user.email,
      emailSalutationFromUser({ username: user.username, email: user.email }),
      `${baseUrl}/reset-password/${rawToken}`,
    )

    return NextResponse.json({
      success: true,
      message: `Passwort-Reset-Link wurde an ${user.email} gesendet.`,
    })
  } catch (err) {
    console.error("[admin/users/send-password-reset] error:", err)
    return NextResponse.json({ error: "Fehler beim Senden." }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/auth/verify-email/[token]
 * Verifiziert die E-Mail über den Link aus der Verifizierungs-Mail.
 * Redirect nach /verify-email/success oder /verify-email?error=expired|invalid
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 32) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid", process.env.NEXTAUTH_URL || "https://diaiway.com")
    )
  }

  try {
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
      select: { id: true, emailVerificationExpiry: true, emailConfirmedAt: true },
    })

    if (!user) {
      return NextResponse.redirect(
        new URL("/verify-email?error=invalid", process.env.NEXTAUTH_URL || "https://diaiway.com")
      )
    }

    if (user.emailConfirmedAt) {
      return NextResponse.redirect(
        new URL("/verify-email/success", process.env.NEXTAUTH_URL || "https://diaiway.com")
      )
    }

    const expiry = user.emailVerificationExpiry
    if (!expiry || expiry < new Date()) {
      return NextResponse.redirect(
        new URL("/verify-email?error=expired", process.env.NEXTAUTH_URL || "https://diaiway.com")
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailConfirmedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    })

    return NextResponse.redirect(
      new URL("/verify-email/success", process.env.NEXTAUTH_URL || "https://diaiway.com")
    )
  } catch (err) {
    console.error("[verify-email] Error:", err)
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid", process.env.NEXTAUTH_URL || "https://diaiway.com")
    )
  }
}

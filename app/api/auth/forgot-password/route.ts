import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json(
        { error: "Bitte eine E-Mail-Adresse eingeben." },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet.",
      })
    }

    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashedToken, resetTokenExpiry },
    })

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    await sendPasswordResetEmail(user.email, user.name, `${baseUrl}/reset-password/${resetToken}`)

    return NextResponse.json({
      success: true,
      message: "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet.",
    })
  } catch (err: unknown) {
    console.error("[diAiway] forgot-password error:", err)
    return NextResponse.json(
      { error: "Fehler beim Senden der E-Mail. Bitte versuche es spaeter erneut." },
      { status: 500 }
    )
  }
}

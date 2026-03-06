import { NextResponse } from "next/server"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token und neues Passwort sind erforderlich." },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 6 Zeichen lang sein." },
        { status: 400 }
      )
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Der Link ist ungueltig oder abgelaufen. Bitte fordere einen neuen an." },
        { status: 400 }
      )
    }

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
    return NextResponse.json(
      { error: "Fehler beim Zuruecksetzen. Bitte versuche es erneut." },
      { status: 500 }
    )
  }
}

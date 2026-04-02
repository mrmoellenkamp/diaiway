import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * POST /api/user/marketing
 * Marketing-Double-Opt-In bestätigen.
 * Body: { action: "confirm-doi" }
 * Setzt marketingDoubleOptInAt – erforderlich nach UWG § 7 Abs. 2 Nr. 3
 * für werbliche E-Mails an eigene Bestandskunden.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { action } = body as { action?: string }

  if (action !== "confirm-doi") {
    return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      marketingDoubleOptInAt: new Date(),
      marketingOptIn: true,
      marketingOptInAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/user/marketing
 * Marketing-Einwilligung widerrufen (DSGVO Art. 7 Abs. 3, UWG).
 * Setzt marketingOptIn = false und löscht Zeitstempel.
 */
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      marketingOptIn: false,
      marketingOptInAt: null,
      marketingDoubleOptInAt: null,
    },
  })

  return NextResponse.json({ ok: true })
}

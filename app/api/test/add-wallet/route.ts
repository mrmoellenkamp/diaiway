/**
 * E2E: Guthaben für den eingeloggten User hinzufügen.
 * Nur aktiv wenn E2E_ENABLED=true
 */

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (process.env.E2E_ENABLED !== "true") {
    return NextResponse.json({ error: "E2E API deaktiviert." }, { status: 404 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const amount = Math.min(100000, Math.max(1000, Number(body.amount) || 10000)) // 10–1000 EUR
    await prisma.user.update({
      where: { id: session.user.id },
      data: { balance: { increment: amount } },
    })
    return NextResponse.json({ success: true, amount })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

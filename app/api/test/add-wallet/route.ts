/**
 * E2E: Guthaben für den eingeloggten User hinzufügen.
 * Nur aktiv wenn E2E_ENABLED=true und NODE_ENV !== production.
 * Erfordert eingeloggte Session (JWT).
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "E2E API in Production deaktiviert." }, { status: 404 })
  }
  if (process.env.E2E_ENABLED !== "true") {
    return NextResponse.json({ error: "E2E API deaktiviert." }, { status: 404 })
  }
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const session = authResult.session

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

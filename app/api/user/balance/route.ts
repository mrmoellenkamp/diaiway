import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/user/balance
 * Gibt das aktuelle Guthaben des eingeloggten Users zurück (EUR Cents).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true },
  })

  return NextResponse.json({ balanceCents: user?.balance ?? 0 })
}

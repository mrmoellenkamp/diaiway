import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { creditWalletAdmin } from "@/lib/wallet-service"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return { error: "Nicht autorisiert." as const, status: 401 as const }
  }
  return { session }
}

/**
 * POST /api/admin/users/[id]/wallet-credit
 * Admin: Guthaben auf Nutzer-Wallet gutschreiben.
 * Body: { amountCents: number, reason?: string }
 * Erzeugt echten Zahlungsvorgang: WalletTransaction, PDF-Rechnung.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id: userId } = await params
  if (!userId) return NextResponse.json({ error: "User-ID fehlt." }, { status: 400 })

  let body: { amountCents?: number; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const amountCents = typeof body.amountCents === "number" ? Math.round(body.amountCents) : 0
  if (amountCents <= 0) {
    return NextResponse.json({ error: "Betrag muss positiv sein (in Cent)." }, { status: 400 })
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined

  const result = await creditWalletAdmin(userId, amountCents, check.session.user.id, reason)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Fehler bei der Gutschrift." }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Gutschrift von ${(amountCents / 100).toFixed(2).replace(".", ",")} € erfolgreich.`,
    walletTransactionId: result.walletTransactionId,
  })
}

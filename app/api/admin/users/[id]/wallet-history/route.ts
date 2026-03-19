import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getWalletHistory, getTakumiWallet } from "@/lib/wallet-service"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return { error: "Nicht autorisiert." as const, status: 401 as const }
  }
  return { session }
}

/**
 * GET /api/admin/users/[id]/wallet-history
 * Admin: Kontoauszug (Finanzdaten + Transaktionsverlauf) eines Nutzers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id: userId } = await params
  if (!userId) return NextResponse.json({ error: "User-ID fehlt." }, { status: 400 })

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || "100")))

  try {
    const [history, wallet] = await Promise.all([
      getWalletHistory(userId, limit),
      getTakumiWallet(userId),
    ])

    return NextResponse.json({
      history,
      wallet: wallet ?? { balance: 0, pendingBalance: 0, canWithdraw: false },
    })
  } catch (err) {
    console.error("[admin/wallet-history] Error:", err)
    return NextResponse.json({ error: "Fehler beim Laden des Kontoauszugs." }, { status: 500 })
  }
}

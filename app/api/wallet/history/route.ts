import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTakumiWallet, getWalletHistory } from "@/lib/wallet-service"

export const runtime = "nodejs"

/**
 * GET /api/wallet/history
 * Transaktionshistorie + Salden für den eingeloggten Nutzer.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || "50")))

  try {
    const [history, wallet] = await Promise.all([
      getWalletHistory(session.user.id, limit),
      getTakumiWallet(session.user.id),
    ])
    return NextResponse.json(
      {
        history,
        wallet: wallet ?? { balance: 0, pendingBalance: 0, canWithdraw: false },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    )
  } catch (err) {
    console.error("[Wallet] history error:", err)
    return NextResponse.json({ error: "Fehler beim Laden der Historie." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { creditWalletTopup } from "@/lib/wallet-service"
import { getTakumiWallet } from "@/lib/wallet-service"

/**
 * POST /api/wallet/topup/confirm
 * Prüft Stripe-Session nach Embedded-Checkout und gutschreibt das Wallet.
 * Fallback, wenn der Webhook verzögert ist oder fehlschlägt.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  let sessionId: string
  try {
    const body = await req.json().catch(() => ({}))
    sessionId = body?.sessionId ?? body?.session_id
    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "sessionId fehlt." }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 })
  }

  try {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId)
    if (stripeSession.metadata?.type !== "wallet_topup") {
      return NextResponse.json({ error: "Keine Wallet-Aufladung." }, { status: 400 })
    }
    if (stripeSession.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: "Session gehört nicht zu diesem Nutzer." }, { status: 403 })
    }
    if (stripeSession.status !== "complete") {
      return NextResponse.json({ status: "pending", message: "Zahlung noch nicht abgeschlossen." })
    }
    if (stripeSession.payment_status !== "paid") {
      return NextResponse.json({ status: "pending", message: "Zahlung wird verarbeitet." })
    }

    const amountTotal = stripeSession.amount_total ?? 0
    const result = await creditWalletTopup(session.user.id, amountTotal, stripeSession.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Gutschrift fehlgeschlagen." }, { status: 500 })
    }

    const wallet = await getTakumiWallet(session.user.id)
    return NextResponse.json({
      ok: true,
      amountCents: amountTotal,
      balance: wallet?.balance ?? 0,
      pendingBalance: wallet?.pendingBalance ?? 0,
    })
  } catch (err) {
    console.error("[wallet/topup/confirm]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bestätigung fehlgeschlagen." },
      { status: 500 }
    )
  }
}

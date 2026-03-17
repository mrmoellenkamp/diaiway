import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { createHmac } from "crypto"
import { creditWalletTopup } from "@/lib/wallet-service"
import { getTakumiWallet } from "@/lib/wallet-service"

function validateWalletToken(token: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split(":")
    if (parts.length !== 4) return null
    const [userId, amountCentsStr, expiresAtStr, sig] = parts
    if (Date.now() > parseInt(expiresAtStr, 10)) return null
    const payload = `${userId}:${amountCentsStr}:${expiresAtStr}`
    const secret = process.env.NEXTAUTH_SECRET!
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex")
    if (sig !== expectedSig) return null
    return { userId }
  } catch {
    return null
  }
}

/**
 * POST /api/wallet/topup/confirm
 * Prüft Stripe-Session nach Embedded-Checkout und gutschreibt das Wallet.
 * Unterstützt Session (Web) und token (In-App-Browser auf iOS ohne Cookies).
 */
export async function POST(req: Request) {
  let userId: string
  const session = await auth()
  const body = await req.json().catch(() => ({}))
  const tokenParam = body?.token

  if (tokenParam && typeof tokenParam === "string") {
    const tokenData = validateWalletToken(tokenParam)
    if (!tokenData) {
      return NextResponse.json({ error: "Ungültiger oder abgelaufener Token." }, { status: 401 })
    }
    userId = tokenData.userId
  } else if (session?.user?.id) {
    userId = session.user.id
  } else {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  let sessionId: string
  try {
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
    if (stripeSession.metadata?.userId !== userId) {
      return NextResponse.json({ error: "Session gehört nicht zu diesem Nutzer." }, { status: 403 })
    }
    if (stripeSession.status !== "complete") {
      return NextResponse.json({ status: "pending", message: "Zahlung noch nicht abgeschlossen." })
    }
    if (stripeSession.payment_status !== "paid") {
      return NextResponse.json({ status: "pending", message: "Zahlung wird verarbeitet." })
    }

    const amountTotal = stripeSession.amount_total ?? 0
    const result = await creditWalletTopup(userId, amountTotal, stripeSession.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Gutschrift fehlgeschlagen." }, { status: 500 })
    }

    const wallet = await getTakumiWallet(userId)
    return NextResponse.json({
      ok: true,
      amountCents: amountTotal,
      balance: wallet?.balance ?? 0,
      pendingBalance: wallet?.pendingBalance ?? 0,
    })
  } catch (err) {
    console.error("[wallet/topup/confirm]", err)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json(
      { error: sanitizeErrorForClient(err) },
      { status: 500 }
    )
  }
}

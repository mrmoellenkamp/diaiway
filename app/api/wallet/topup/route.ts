import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { createHmac } from "crypto"

const MIN_AMOUNT_CENTS = 2000
const MAX_AMOUNT_CENTS = 10000

function validateWalletToken(token: string): { userId: string; amountCents: number } | null {
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
    return { userId, amountCents: parseInt(amountCentsStr, 10) }
  } catch {
    return null
  }
}

/**
 * POST /api/wallet/topup
 * Erstellt eine Stripe-Checkout-Session für Wallet-Aufladung.
 * Unterstützt NextAuth-Session (normal) und ?token= (In-App-Browser auf iOS).
 * Body: { amountCents?: number } – 20–100 €.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const tokenParam = url.searchParams.get("token")

  let userId: string
  let amountCents = MIN_AMOUNT_CENTS

  if (tokenParam) {
    // Token-basierter Zugriff vom In-App-Browser
    const tokenData = validateWalletToken(tokenParam)
    if (!tokenData) {
      return NextResponse.json({ error: "Ungültiger oder abgelaufener Token." }, { status: 401 })
    }
    userId = tokenData.userId
    amountCents = tokenData.amountCents
  } else {
    // Normale Session-basierte Anfrage
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
    }
    userId = session.user.id

    try {
      const body = await req.json().catch(() => ({}))
      const requested = body?.amountCents ?? body?.amount
      if (typeof requested === "number" && requested >= MIN_AMOUNT_CENTS) {
        amountCents = Math.round(requested)
      } else if (typeof requested === "string") {
        const parsed = parseFloat(requested)
        if (!isNaN(parsed) && parsed * 100 >= MIN_AMOUNT_CENTS) {
          amountCents = Math.round(parsed * 100)
        }
      }
    } catch { /* use default */ }
  }

  if (amountCents > MAX_AMOUNT_CENTS) {
    return NextResponse.json(
      { error: `Maximal ${MAX_AMOUNT_CENTS / 100} € pro Aufladung.` },
      { status: 400 }
    )
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      redirect_on_completion: "never",
      payment_method_types: ["card"],
      wallet_options: { link: { display: "never" } },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "diAiway Wallet-Aufladung",
              description: "Guthaben für Instant-Connect & Buchungen",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        userId,
        type: "wallet_topup",
      },
    })

    return NextResponse.json({
      clientSecret: checkoutSession.client_secret,
      sessionId: checkoutSession.id,
      amountCents,
    })
  } catch (err) {
    console.error("[wallet/topup] Stripe error:", err)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json(
      { error: sanitizeErrorForClient(err) },
      { status: 500 }
    )
  }
}

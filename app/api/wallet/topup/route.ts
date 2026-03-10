import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"

const MIN_AMOUNT_CENTS = 2000 // 20 €

/**
 * POST /api/wallet/topup
 * Erstellt eine Stripe-Checkout-Session für Wallet-Aufladung.
 * Body: { amountCents?: number } – frei wählbar, mindestens 20 €.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  let amountCents = MIN_AMOUNT_CENTS
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

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      redirect_on_completion: "never",
      payment_method_types: ["card"],
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
        userId: session.user.id,
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"

const TOPUP_AMOUNT_CENTS = 2000 // 20 €

/**
 * POST /api/wallet/topup
 * Erstellt eine Stripe-Checkout-Session für Wallet-Aufladung (20 €).
 * Return: { url } für Redirect oder { clientSecret, sessionId } für Embedded.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

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
            unit_amount: TOPUP_AMOUNT_CENTS,
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
      amountCents: TOPUP_AMOUNT_CENTS,
    })
  } catch (err) {
    console.error("[wallet/topup] Stripe error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}

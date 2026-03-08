import "server-only"

import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

/**
 * Hold & Capture: Vor Capture → cancel (Autorisierung verfällt).
 * Nach Capture → refund (Geld zurück).
 */
export async function cancelOrRefundPaymentIntent(
  paymentIntentId: string,
  options?: { amount?: number; reason?: Stripe.RefundCreateParams["reason"] }
): Promise<{ ok: true; action: "canceled" | "refunded" } | { ok: false; error: string }> {
  if (!paymentIntentId || paymentIntentId === "wallet") {
    return { ok: false, error: "Kein Stripe PaymentIntent" }
  }
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (pi.status === "requires_capture") {
      await stripe.paymentIntents.cancel(paymentIntentId)
      return { ok: true, action: "canceled" }
    }
    if (pi.status === "succeeded") {
      const params: Stripe.RefundCreateParams = { payment_intent: paymentIntentId }
      if (options?.amount && options.amount > 0) params.amount = options.amount
      if (options?.reason) params.reason = options.reason
      await stripe.refunds.create(params)
      return { ok: true, action: "refunded" }
    }
    return { ok: false, error: `Unerwarteter PaymentIntent-Status: ${pi.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stripe-Fehler" }
  }
}

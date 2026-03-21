import { loadStripe, type Stripe } from "@stripe/stripe-js"

/**
 * Stripe.js nur im Browser laden – vermeidet RSC/SSR-Fehler mit Embedded Checkout
 * („An error occurred in the Server Components render“ in Production).
 * Nicht als Top-Level `loadStripe(...)` in Client-Bundles aufrufen.
 */
export function createStripeBrowserPromise(): Promise<Stripe | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null)
  }
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) {
    console.error("[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY fehlt")
    return Promise.resolve(null)
  }
  return loadStripe(key)
}

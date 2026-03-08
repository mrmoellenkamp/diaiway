"use client"

import { useState, useEffect } from "react"
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Loader2 } from "lucide-react"
import { startSessionCheckout, verifySessionPayment, type SessionCheckoutParams } from "@/app/actions/stripe"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface SessionCheckoutProps {
  bookingId: string
  takumiName: string
  duration: number
  priceInCents: number
  onSuccess: () => void
  onError: (error: string) => void
}

export function SessionCheckout({
  bookingId,
  takumiName,
  duration,
  priceInCents,
  onSuccess,
  onError,
}: SessionCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)

  const checkPayment = async () => {
    try {
      const result = await verifySessionPayment(bookingId)
      if (result.status === "paid") {
        setPolling(false)
        onSuccess()
        return true
      }
      if (result.status === "failed") {
        setPolling(false)
        onError("Zahlung fehlgeschlagen")
        return true
      }
    } catch {
      /* weiter pollen */
    }
    return false
  }

  // Stripe onComplete: Sofort prüfen, wenn Zahlung abgeschlossen (wie BookingCheckout)
  const handleComplete = async () => {
    for (let i = 0; i < 5; i++) {
      try {
        const result = await verifySessionPayment(bookingId)
        if (result.status === "paid") {
          setPolling(false)
          onSuccess()
          return
        }
      } catch {
        /* weiter versuchen */
      }
      if (i < 4) await new Promise((r) => setTimeout(r, 500))
    }
    /* Polling übernimmt falls noch nicht paid */
  }

  // Start checkout session on mount
  useEffect(() => {
    const params: SessionCheckoutParams = {
      bookingId,
      takumiName,
      duration,
      priceInCents,
    }

    startSessionCheckout(params)
      .then((result) => {
        setClientSecret(result.clientSecret)
        setLoading(false)
        setPolling(true)
      })
      .catch((err) => {
        onError(err.message || "Checkout konnte nicht gestartet werden")
        setLoading(false)
      })
  }, [bookingId, takumiName, duration, priceInCents, onError])

  // Poll for payment status (Fallback falls onComplete nicht feuert)
  useEffect(() => {
    if (!polling) return

    const interval = setInterval(async () => {
      const done = await checkPayment()
      if (done) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [polling, bookingId, onSuccess, onError])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Zahlungsformular wird geladen...</p>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <p className="text-sm text-destructive">Checkout konnte nicht initialisiert werden.</p>
      </div>
    )
  }

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret: clientSecret!,
          onComplete: () => handleComplete(),
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}

export default SessionCheckout

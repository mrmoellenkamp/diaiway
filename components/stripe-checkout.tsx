"use client"

import { useCallback, useState, useEffect } from "react"
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
        // Start polling for payment confirmation
        setPolling(true)
      })
      .catch((err) => {
        onError(err.message || "Checkout konnte nicht gestartet werden")
        setLoading(false)
      })
  }, [bookingId, takumiName, duration, priceInCents, onError])

  // Poll for payment status
  useEffect(() => {
    if (!polling) return

    const interval = setInterval(async () => {
      try {
        const result = await verifySessionPayment(bookingId)
        if (result.status === "paid") {
          setPolling(false)
          onSuccess()
        } else if (result.status === "failed") {
          setPolling(false)
          onError("Zahlung fehlgeschlagen")
        }
      } catch {
        // Continue polling
      }
    }, 2000)

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
        options={{ clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}

export default SessionCheckout

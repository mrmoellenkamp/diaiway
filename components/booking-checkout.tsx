"use client"

import { useState, useEffect } from "react"
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Loader2, Wallet, CreditCard } from "lucide-react"
import { startBookingCheckout, verifySessionPayment } from "@/app/actions/stripe"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface BookingCheckoutProps {
  bookingId: string
  takumiName: string
  priceInCents: number
  walletBalanceCents?: number
  onSuccess: () => void
  onError: (error: string) => void
}

export function BookingCheckout({
  bookingId,
  takumiName,
  priceInCents,
  walletBalanceCents = 0,
  onSuccess,
  onError,
}: BookingCheckoutProps) {
  const { t } = useI18n()
  const canPayWithWallet = walletBalanceCents >= priceInCents
  const [paymentMethod, setPaymentMethod] = useState<"choice" | "wallet" | "card">(
    canPayWithWallet ? "choice" : "card"
  )
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const startStripe = () => {
    setLoading(true)
    startBookingCheckout({ bookingId, takumiName, priceInCents })
      .then((result) => {
        setClientSecret(result.clientSecret)
        setLoading(false)
        setPolling(true)
      })
      .catch((err) => {
        onError(err.message || "Checkout konnte nicht gestartet werden")
        setLoading(false)
      })
  }

  useEffect(() => {
    if (paymentMethod === "card" && !clientSecret && !loading) {
      startStripe()
    }
  }, [paymentMethod])

  const ensureTakumiNotified = () => {
    fetch(`/api/bookings/${bookingId}/notify-takumi`, { method: "POST" }).catch(() => {})
  }

  const checkPayment = async () => {
    try {
      const result = await verifySessionPayment(bookingId)
      if (result.status === "paid") {
        setPolling(false)
        ensureTakumiNotified()
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

  // onComplete: Sofort prüfen, wenn Stripe Zahlung meldet (kein Warten auf Poll)
  const handleComplete = () => {
    checkPayment()
  }

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      const done = await checkPayment()
      if (done) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [polling, bookingId, onSuccess, onError])

  async function handlePayWithWallet() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/pay-with-wallet`, {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        ensureTakumiNotified()
        onSuccess()
      } else {
        onError(data.error || "Zahlung fehlgeschlagen")
      }
    } catch {
      onError(t("handshake.walletPayError"))
    } finally {
      setLoading(false)
    }
  }

  // Auswahl: Wallet oder Karte
  if (paymentMethod === "choice") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("handshake.choosePaymentMethod")}</p>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="h-12 justify-start gap-3"
            onClick={handlePayWithWallet}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Wallet className="size-5 text-accent" />
            )}
            <span>{t("handshake.payWithWallet")}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {(walletBalanceCents / 100).toFixed(2)} €
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-12 justify-start gap-3"
            onClick={() => setPaymentMethod("card")}
          >
            <CreditCard className="size-5" />
            <span>{t("handshake.payWithCard")}</span>
          </Button>
        </div>
      </div>
    )
  }

  if (loading && !clientSecret) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("handshake.loadingPayment")}</p>
      </div>
    )
  }

  if (paymentMethod === "card" && !clientSecret) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <p className="text-sm text-destructive">{t("handshake.checkoutError")}</p>
      </div>
    )
  }

  async function handlePaymentComplete() {
    // Stripe onComplete: Sofort prüfen, ggf. mit Retries (API kann kurz verzögert sein)
    for (let i = 0; i < 5; i++) {
      try {
        const result = await verifySessionPayment(bookingId)
        if (result.status === "paid") {
          setPolling(false)
          ensureTakumiNotified()
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

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret: clientSecret!,
          onComplete: () => handlePaymentComplete(),
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}

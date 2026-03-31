"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js"
import { Loader2 } from "lucide-react"
import { startSessionCheckout, verifySessionPayment, type SessionCheckoutParams } from "@/app/actions/stripe"
import { createStripeBrowserPromise } from "@/lib/stripe-client"
import { useI18n } from "@/lib/i18n"
import type { Stripe } from "@stripe/stripe-js"

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
  const { t } = useI18n()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)

  useEffect(() => {
    setStripePromise(createStripeBrowserPromise())
  }, [])

  // Ref-Wrapper: stabile Funktionsidentität für onComplete
  const onCompleteRef = useRef<() => Promise<void>>(async () => {})
  const stableOnComplete = useCallback(() => onCompleteRef.current(), [])

  const checkPayment = useCallback(async () => {
    try {
      const result = await verifySessionPayment(bookingId)
      if (result.status === "paid") {
        setPolling(false)
        onSuccess()
        return true
      }
      if (result.status === "failed") {
        setPolling(false)
        onError(t("booking.paymentFailed"))
        return true
      }
    } catch {
      /* weiter pollen */
    }
    return false
  }, [bookingId, onSuccess, onError, t])

  // Ref immer aktuell halten
  onCompleteRef.current = async () => {
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

  const options = useMemo(
    () => (clientSecret ? { clientSecret, onComplete: stableOnComplete } : null),
    [clientSecret, stableOnComplete]
  )

  useEffect(() => {
    const params: SessionCheckoutParams = {
      bookingId,
      takumiName,
      duration,
      priceInCents,
    }

    startSessionCheckout(params)
      .then((result) => {
        if (!result.ok) {
          onError(result.error)
          setLoading(false)
          return
        }
        setClientSecret(result.clientSecret)
        setLoading(false)
        setPolling(true)
      })
      .catch((err) => {
        onError(err.message || t("booking.checkoutStartFailed"))
        setLoading(false)
      })
  }, [bookingId, takumiName, duration, priceInCents, onError, t])

  useEffect(() => {
    if (!polling) return

    const interval = setInterval(async () => {
      const done = await checkPayment()
      if (done) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [polling, checkPayment])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("handshake.loadingPayment")}</p>
      </div>
    )
  }

  if (!clientSecret || !options) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <p className="text-sm text-destructive">{t("handshake.checkoutError")}</p>
      </div>
    )
  }

  if (!stripePromise) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("handshake.loadingPayment")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div id="checkout" className="w-full">
        <EmbeddedCheckoutProvider key={clientSecret} stripe={stripePromise} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
      <p className="text-center text-[11px] leading-relaxed text-[rgba(120,113,108,0.7)]">
        {t("handshake.p2pNotice")}
      </p>
    </div>
  )
}

export default SessionCheckout

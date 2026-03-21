"use client"

import { use, useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js"
import type { Stripe } from "@stripe/stripe-js"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { createStripeBrowserPromise } from "@/lib/stripe-client"

function PayPageInner({ bookingId }: { bookingId: string }) {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [polling, setPolling] = useState(false)
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)

  useEffect(() => {
    setStripePromise(createStripeBrowserPromise())
  }, [])

  // Ref-Wrapper für stabile onComplete-Referenz
  const onCompleteRef = useRef<() => Promise<void>>(async () => {})
  const stableOnComplete = useCallback(() => onCompleteRef.current(), [])

  const checkPayment = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/pay/${bookingId}?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      if (data.status === "paid") {
        setPolling(false)
        setStatus("success")
        // Deep Link zurück zur App
        setTimeout(() => {
          window.location.href = `diaiway://booking-confirmed/${bookingId}`
        }, 1500)
        return true
      }
    } catch {
      // weiter pollen
    }
    return false
  }, [bookingId, token])

  onCompleteRef.current = async () => {
    for (let i = 0; i < 5; i++) {
      const done = await checkPayment()
      if (done) return
      if (i < 4) await new Promise((r) => setTimeout(r, 500))
    }
    // Polling übernimmt
  }

  const options = useMemo(
    () => (clientSecret ? { clientSecret, onComplete: stableOnComplete } : null),
    [clientSecret, stableOnComplete]
  )

  useEffect(() => {
    if (!token || !bookingId) {
      setStatus("error")
      setErrorMsg("Ungültiger Aufruf.")
      return
    }

    fetch(`/api/pay/${bookingId}?token=${encodeURIComponent(token)}`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
          setStatus("ready")
          setPolling(true)
        } else {
          setStatus("error")
          setErrorMsg(data.error ?? "Checkout konnte nicht gestartet werden.")
        }
      })
      .catch(() => {
        setStatus("error")
        setErrorMsg("Netzwerkfehler. Bitte versuche es erneut.")
      })
  }, [bookingId, token])

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      const done = await checkPayment()
      if (done) clearInterval(interval)
    }, 1500)
    return () => clearInterval(interval)
  }, [polling, checkPayment])

  return (
    <div className="min-h-screen bg-white">
      {status === "loading" && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <Loader2 className="size-10 animate-spin text-emerald-700" />
          <p className="text-sm text-stone-500">Zahlungsformular wird vorbereitet…</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle className="size-7 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-stone-900">Fehler</p>
            <p className="mt-1 text-sm text-stone-500">{errorMsg}</p>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-stone-900">Zahlung erfolgreich!</p>
            <p className="mt-1 text-sm text-stone-500">
              Ihre Zahlung wurde sicher durchgeführt und Sie werden in Ihre Buchungsübersicht weitergeleitet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-emerald-900">
              <span className="text-[10px] font-bold text-white">di</span>
            </div>
            <span className="text-sm font-semibold text-stone-700">
              di<span className="text-emerald-600">Ai</span>way
            </span>
          </div>
        </div>
      )}

      {status === "ready" && clientSecret && options && stripePromise && (
        <EmbeddedCheckoutProvider key={clientSecret} stripe={stripePromise} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
      {status === "ready" && clientSecret && options && !stripePromise && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <Loader2 className="size-10 animate-spin text-emerald-700" />
          <p className="text-sm text-stone-500">Zahlungsformular wird vorbereitet…</p>
        </div>
      )}
    </div>
  )
}

export default function PayPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params)
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-700" />
      </div>
    }>
      <PayPageInner bookingId={bookingId} />
    </Suspense>
  )
}

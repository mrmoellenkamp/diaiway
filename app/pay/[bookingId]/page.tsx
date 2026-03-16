"use client"

import { use, useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function PayPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [polling, setPolling] = useState(false)

  // Ref-Wrapper für stabile onComplete-Referenz
  const onCompleteRef = useRef<() => Promise<void>>(async () => {})
  const stableOnComplete = useCallback(() => onCompleteRef.current(), [])

  const checkPayment = async (): Promise<boolean> => {
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
  }

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
  }, [polling])

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Minimaler Header */}
      <div className="sticky top-0 z-10 flex items-center justify-center border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-900">
            <span className="text-xs font-bold text-white">di</span>
          </div>
          <span className="text-base font-bold text-stone-900">
            di<span className="text-amber-500">Ai</span>way
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-6">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="size-10 animate-spin text-emerald-700" />
            <p className="text-sm text-stone-500">Zahlungsformular wird vorbereitet…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
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
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Zahlung erfolgreich!</p>
              <p className="mt-1 text-sm text-stone-500">Du wirst zurück zur App weitergeleitet…</p>
            </div>
          </div>
        )}

        {status === "ready" && clientSecret && options && (
          <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <EmbeddedCheckoutProvider key={clientSecret} stripe={stripePromise} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function WalletPayInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  const onCompleteRef = useRef<() => Promise<void>>(async () => {})
  const stableOnComplete = useCallback(() => onCompleteRef.current(), [])

  const confirmAndRedirect = async () => {
    if (!sessionId) return
    for (let i = 0; i < 8; i++) {
      try {
        const res = await fetch("/api/wallet/topup/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, token }),
        })
        const data = await res.json()
        if (data.ok) {
          setStatus("success")
          setTimeout(() => {
            window.location.href = "diaiway://wallet-topup-confirmed"
          }, 1500)
          return
        }
        if (data.status !== "pending") break
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    setStatus("error")
    setErrorMsg("Gutschrift konnte nicht bestätigt werden. Bitte prüfe dein Guthaben in Kürze oder kontaktiere den Support.")
  }

  onCompleteRef.current = async () => {
    await confirmAndRedirect()
  }

  const options = useMemo(
    () => (clientSecret ? { clientSecret, onComplete: stableOnComplete } : null),
    [clientSecret, stableOnComplete]
  )

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setErrorMsg("Ungültiger Aufruf.")
      return
    }

    fetch(`/api/wallet/topup?token=${encodeURIComponent(token)}`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
          setSessionId(data.sessionId ?? null)
          setStatus("ready")
        } else {
          setStatus("error")
          setErrorMsg(data.error ?? "Checkout konnte nicht gestartet werden.")
        }
      })
      .catch(() => {
        setStatus("error")
        setErrorMsg("Netzwerkfehler. Bitte versuche es erneut.")
      })
  }, [token])

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
            <p className="text-lg font-bold text-stone-900">Wallet aufgeladen!</p>
            <p className="mt-1 text-sm text-stone-500">
              Dein Guthaben wurde erfolgreich aufgeladen. Du wirst zurück zur App weitergeleitet.
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

      {status === "ready" && clientSecret && options && (
        <EmbeddedCheckoutProvider key={clientSecret} stripe={stripePromise} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
    </div>
  )
}

export default function WalletPayPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-700" />
      </div>
    }>
      <WalletPayInner />
    </Suspense>
  )
}

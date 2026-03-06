"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SessionCheckout } from "@/components/stripe-checkout"
import { X, Loader2, CheckCircle2, CreditCard } from "lucide-react"

interface HandshakeOverlayProps {
  isOpen: boolean
  bookingId: string
  takumiName: string
  onPaymentSuccess: () => void
  onEnd: () => void
  price: number     // price in cents
  duration: number  // duration in minutes
}

type Step = "decision" | "checkout" | "success"

export function HandshakeOverlay({
  isOpen,
  bookingId,
  takumiName,
  onPaymentSuccess,
  onEnd,
  price,
  duration,
}: HandshakeOverlayProps) {
  const [step, setStep] = useState<Step>("decision")
  const [error, setError] = useState("")

  if (!isOpen) return null

  const priceEuro = (price / 100).toFixed(2)

  const handleContinueToCheckout = () => {
    setStep("checkout")
    setError("")
  }

  const handlePaymentSuccess = () => {
    setStep("success")
    // Auto-continue after success animation
    setTimeout(() => {
      onPaymentSuccess()
    }, 1500)
  }

  const handlePaymentError = (errorMsg: string) => {
    setError(errorMsg)
    setStep("decision")
  }

  // Decision screen
  if (step === "decision") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-handshake-enter">
        <div className="relative mx-4 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300 p-8 text-center shadow-2xl">
          <button
            onClick={onEnd}
            className="absolute right-3 top-3 rounded-full bg-black/10 p-1.5 text-amber-900 transition-colors hover:bg-black/20"
            aria-label="Schliessen"
          >
            <X className="size-5" />
          </button>

          <div className="flex size-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <span className="font-serif text-4xl">握</span>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-amber-900">
              Problem analysiert?
            </h2>
            <p className="text-sm text-amber-800/80">
              Die kostenlose Probezeit ist vorbei. Moechtest du die Session fortsetzen?
            </p>
          </div>

          {error && (
            <div className="w-full rounded-lg bg-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={handleContinueToCheckout}
              className="h-14 w-full rounded-xl bg-amber-900 text-lg font-bold text-amber-50 hover:bg-amber-950 shadow-lg"
            >
              <CreditCard className="mr-2 size-5" />
              Weiter fuer {priceEuro} EUR ({duration} Min)
            </Button>
            <Button
              onClick={onEnd}
              variant="ghost"
              className="w-full text-amber-800 hover:text-amber-900 hover:bg-amber-500/20"
            >
              Sitzung beenden
            </Button>
          </div>

          <p className="text-[10px] text-amber-800/60">
            Sichere Zahlung via Stripe
          </p>
        </div>
      </div>
    )
  }

  // Checkout screen
  if (step === "checkout") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-handshake-enter overflow-auto py-8">
        <div className="relative mx-4 flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-card p-6 text-center shadow-2xl">
          <button
            onClick={() => setStep("decision")}
            className="absolute right-3 top-3 rounded-full bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-muted/80"
            aria-label="Zurueck"
          >
            <X className="size-5" />
          </button>

          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-foreground">
              Zahlung fuer Session
            </h2>
            <p className="text-sm text-muted-foreground">
              {duration} Minuten mit {takumiName}
            </p>
          </div>

          <div className="w-full rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Betrag:</span>
              <span className="text-lg font-bold text-foreground">{priceEuro} EUR</span>
            </div>
          </div>

          <div className="w-full">
            <SessionCheckout
              bookingId={bookingId}
              takumiName={takumiName}
              duration={duration}
              priceInCents={price}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        </div>
      </div>
    )
  }

  // Success screen
  if (step === "success") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-handshake-enter">
        <div className="relative mx-4 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-gradient-to-br from-accent to-emerald-500 p-8 text-center shadow-2xl">
          <div className="flex size-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm animate-pulse">
            <CheckCircle2 className="size-10 text-white" />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-white">
              Zahlung erfolgreich!
            </h2>
            <p className="text-sm text-white/80">
              Session wird fortgesetzt...
            </p>
          </div>

          <Loader2 className="size-6 animate-spin text-white/60" />
        </div>
      </div>
    )
  }

  return null
}

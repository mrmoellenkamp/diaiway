"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Wallet } from "lucide-react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
const MIN_EUR = 20

interface WalletTopupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function WalletTopupModal({
  open,
  onOpenChange,
  onSuccess,
}: WalletTopupModalProps) {
  const [step, setStep] = useState<"amount" | "checkout">("amount")
  const [amountEur, setAmountEur] = useState(20)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setStep("amount")
      setAmountEur(20)
      setClientSecret(null)
      setError(null)
      return
    }
  }, [open])

  async function startCheckout() {
    const amount = Number(amountEur)
    if (isNaN(amount) || amount < MIN_EUR) {
      setError(`Mindestens ${MIN_EUR} € erforderlich.`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(amount * 100) }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setStep("checkout")
      } else {
        setError(data.error || "Checkout konnte nicht gestartet werden.")
      }
    } catch {
      setError("Netzwerkfehler")
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    onSuccess?.()
    onOpenChange(false)
    // Webhook verarbeitet asynchron – Balance nach kurzer Verzögerung erneut laden
    if (onSuccess) {
      setTimeout(() => onSuccess(), 2000)
      setTimeout(() => onSuccess(), 4000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wallet aufladen</DialogTitle>
        </DialogHeader>
        <div className="min-h-[300px]">
          {step === "amount" && (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                Wähle den Betrag (mindestens {MIN_EUR} €):
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  {[20, 50, 100, 200].map((val) => (
                    <Button
                      key={val}
                      variant={amountEur === val ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setAmountEur(val); setError(null) }}
                    >
                      {val} €
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Oder:</span>
                  <Input
                    type="number"
                    min={MIN_EUR}
                    step={1}
                    value={amountEur}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setAmountEur(isNaN(v) ? MIN_EUR : Math.max(MIN_EUR, v))
                      setError(null)
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">€</span>
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                onClick={startCheckout}
                disabled={loading || amountEur < MIN_EUR}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wallet className="size-4" />
                )}
                {loading ? "Wird geladen…" : `${amountEur} € aufladen`}
              </Button>
            </div>
          )}

          {step === "checkout" && (
            <>
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Zahlungsformular wird geladen...
                  </p>
                </div>
              )}
              {error && (
                <div className="py-8 text-center text-destructive text-sm">
                  {error}
                </div>
              )}
              {clientSecret && !loading && (
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    onComplete: () => handleComplete(),
                  }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

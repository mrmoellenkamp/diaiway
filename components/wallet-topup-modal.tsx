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
import { Loader2 } from "lucide-react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setClientSecret(null)
      setError(null)
      return
    }
    setLoading(true)
    fetch("/api/wallet/topup", { method: "POST", credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setError(data.error || "Checkout konnte nicht gestartet werden.")
        }
      })
      .catch(() => setError("Netzwerkfehler"))
      .finally(() => setLoading(false))
  }, [open])

  const handleComplete = () => {
    onSuccess?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Wallet aufladen</DialogTitle>
        </DialogHeader>
        <div className="min-h-[300px]">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

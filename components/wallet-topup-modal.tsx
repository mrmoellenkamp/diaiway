"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Capacitor } from "@capacitor/core"
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
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
const MIN_EUR = 20
const MAX_EUR = 100

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
  const { t } = useI18n()
  const router = useRouter()
  const [step, setStep] = useState<"amount" | "checkout">("amount")
  const [amountEur, setAmountEur] = useState(20)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ref-Wrapper: stabile Funktionsidentität für onComplete
  const onCompleteRef = useRef<() => Promise<void>>(async () => {})
  const stableOnComplete = useCallback(() => onCompleteRef.current(), [])

  useEffect(() => {
    if (!open) {
      setStep("amount")
      setAmountEur(20)
      setClientSecret(null)
      setSessionId(null)
      setError(null)
    }
  }, [open])

  const confirmTopup = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false
    try {
      const res = await fetch("/api/wallet/topup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.ok) return true
      if (data.status === "pending") return false
      toast.error(data.error || t("toast.creditFailed"))
      return false
    } catch {
      return false
    }
  }, [sessionId, t])

  // Ref immer aktuell halten — confirmTopup kann sich durch sessionId ändern,
  // aber stableOnComplete bleibt stabil
  onCompleteRef.current = async () => {
    setConfirming(true)
    let ok = false
    for (let i = 0; i < 8; i++) {
      ok = await confirmTopup()
      if (ok) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    setConfirming(false)
    if (ok) {
      import("@/lib/native-utils").then(({ hapticSuccess }) => hapticSuccess())
      toast.success(t("finances.topupSuccess"))
      onOpenChange(false)
      onSuccess?.()
      router.push("/profile/finances")
    } else {
      toast.error(t("toast.paymentConfirmFailed"))
      onOpenChange(false)
      onSuccess?.()
      router.push("/profile/finances")
    }
  }

  const options = useMemo(
    () => (clientSecret ? { clientSecret, onComplete: stableOnComplete } : null),
    [clientSecret, stableOnComplete]
  )

  async function startCheckout() {
    const amount = Number(amountEur)
    if (isNaN(amount) || amount < MIN_EUR) {
      setError(t("wallet.minRequired", { min: MIN_EUR }))
      return
    }
    if (amount > MAX_EUR) {
      setError(t("wallet.maxPerTopup", { max: MAX_EUR }))
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (Capacitor.isNativePlatform()) {
        // Auf iOS: Token holen und Stripe im In-App-Browser öffnen
        const tokenRes = await fetch("/api/wallet/topup/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents: Math.round(amount * 100) }),
          credentials: "include",
        })
        const tokenData = await tokenRes.json()
        if (tokenData.token) {
          onOpenChange(false)
          const payUrl = `https://diaiway.com/pay/wallet?token=${encodeURIComponent(tokenData.token)}`
          const { Browser } = await import("@capacitor/browser")
          await Browser.open({ url: payUrl, presentationStyle: "fullscreen" })
          // DeepLinkHandler fängt diaiway://wallet-topup-confirmed ab
        } else {
          setError(tokenData.error || t("wallet.checkoutError"))
        }
        return
      }

      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(amount * 100) }),
        credentials: "include",
      })
      const data = await res.json()
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setSessionId(data.sessionId ?? null)
        setStep("checkout")
      } else {
        setError(data.error || t("wallet.checkoutError"))
      }
    } catch {
      setError(t("common.networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("wallet.title")}</DialogTitle>
        </DialogHeader>
        <div className="relative min-h-[300px]">
          {step === "amount" && (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                {t("wallet.chooseAmount", { min: MIN_EUR, max: MAX_EUR })}
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {[20, 40, 60, 100].map((val) => (
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
                  <span className="text-sm text-muted-foreground">{t("wallet.or")}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={MIN_EUR}
                    max={MAX_EUR}
                    step={1}
                    value={amountEur}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setAmountEur(isNaN(v) ? MIN_EUR : Math.max(MIN_EUR, Math.min(MAX_EUR, v)))
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
                disabled={loading || amountEur < MIN_EUR || amountEur > MAX_EUR}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wallet className="size-4" />
                )}
                {loading ? t("wallet.loading") : t("wallet.topupAmount", { amount: amountEur })}
              </Button>
            </div>
          )}

          {step === "checkout" && (
            <>
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {t("wallet.loadingForm")}
                  </p>
                </div>
              )}
              {confirming && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/95">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {t("wallet.confirming")}
                  </p>
                </div>
              )}
              {error && (
                <div className="py-8 text-center text-destructive text-sm">
                  {error}
                </div>
              )}
              {clientSecret && !loading && options && (
                <EmbeddedCheckoutProvider key={clientSecret} stripe={stripePromise} options={options}>
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

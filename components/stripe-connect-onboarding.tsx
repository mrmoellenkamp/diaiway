"use client"

import { useEffect, useState, useCallback } from "react"
import { loadConnectAndInitialize } from "@stripe/connect-js"
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectNotificationBanner,
} from "@stripe/react-stripe-js"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

interface StripeConnectOnboardingProps {
  mode: "onboarding" | "management"
  onClose: () => void
  onComplete?: () => void
}

export function StripeConnectOnboarding({
  mode,
  onClose,
  onComplete,
}: StripeConnectOnboardingProps) {
  const { t } = useI18n()
  const [stripeConnectInstance, setStripeConnectInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/connect/account-session", { method: "POST" })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Fehler beim Laden")
    return data.clientSecret as string
  }, [])

  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!publishableKey) {
      setError("Stripe nicht konfiguriert.")
      setLoading(false)
      return
    }

    const instance = loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      appearance: {
        variables: {
          colorPrimary: "#7c3aed",
          fontFamily: "Inter, system-ui, sans-serif",
          borderRadius: "8px",
          spacingUnit: "10px",
          colorText: "#1a1a1a",
          colorBackground: "#ffffff",
        },
      },
    })

    setStripeConnectInstance(instance)
    setLoading(false)
  }, [fetchClientSecret])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Auszahlungskonto wird geladen…</p>
      </div>
    )
  }

  if (error || !stripeConnectInstance) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-destructive">{error || "Fehler beim Laden"}</p>
        <Button variant="outline" size="sm" onClick={onClose}>Schließen</Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-base font-semibold">
          {mode === "onboarding" ? "Auszahlungskonto einrichten" : "Auszahlungskonto verwalten"}
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Schließen"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Stripe Embedded Component */}
      <div className="flex-1 overflow-y-auto">
        <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
          <div className="px-4 pt-3">
            <ConnectNotificationBanner />
          </div>
          <div className="px-4 pb-8 pt-2">
            {mode === "onboarding" ? (
              <ConnectAccountOnboarding
                onExit={() => {
                  onComplete?.()
                  onClose()
                }}
              />
            ) : (
              <ConnectAccountManagement />
            )}
          </div>
        </ConnectComponentsProvider>
      </div>
    </div>
  )
}

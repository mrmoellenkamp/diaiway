"use client"

import { useEffect, useState, useCallback } from "react"
import { loadConnectAndInitialize } from "@stripe/connect-js"
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectAccountManagement,
  ConnectNotificationBanner,
} from "@stripe/react-connect-js"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const isDev = process.env.NODE_ENV === "development"

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
  const [stripeConnectInstance, setStripeConnectInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hostedLoading, setHostedLoading] = useState(false)

  /** Gehostetes Stripe-Onboarding (Account Link) – funktioniert auch ohne Embedded-UI; Return-URL = aktuelle Origin. */
  const startHostedConnect = useCallback(async () => {
    if (typeof window === "undefined") return
    setHostedLoading(true)
    setError(null)
    try {
      const origin = window.location.origin
      const res = await fetch("/api/stripe/connect/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          returnUrl: `${origin}/profile/finances?connect=success`,
          refreshUrl: `${origin}/profile/finances?connect=refresh`,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url as string
        return
      }
      setError((data.error as string) || "Stripe-Fehler")
    } catch {
      setError("Netzwerkfehler")
    } finally {
      setHostedLoading(false)
    }
  }, [])

  const startHostedExpressDashboard = useCallback(async () => {
    setHostedLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/connect/express-login", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url as string
        return
      }
      setError((data.error as string) || "Stripe-Fehler")
    } catch {
      setError("Netzwerkfehler")
    } finally {
      setHostedLoading(false)
    }
  }, [])

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/connect/account-session", { method: "POST" })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Fehler beim Laden")
    return data.clientSecret as string
  }, [])

  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!publishableKey) {
      setError("Stripe nicht konfiguriert (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).")
      setLoading(false)
      return
    }

    try {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect konnte nicht geladen werden.")
    } finally {
      setLoading(false)
    }
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
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Auszahlungskonto</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
          <p className="max-w-md text-center text-sm text-destructive">{error || "Fehler beim Laden"}</p>
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={onClose}>
              Schließen
            </Button>
            {mode === "onboarding" ? (
              <Button size="sm" disabled={hostedLoading} onClick={() => void startHostedConnect()} className="gap-2">
                {hostedLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Onboarding bei Stripe öffnen
              </Button>
            ) : (
              <Button size="sm" disabled={hostedLoading} onClick={() => void startHostedExpressDashboard()} className="gap-2">
                {hostedLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Stripe-Konto verwalten (Browser)
              </Button>
            )}
          </div>
          {isDev && (
            <p className="max-w-lg text-center text-xs text-muted-foreground">
              Lokaler Test: <code className="rounded bg-muted px-1">cloudflared tunnel --url http://localhost:3001</code>
              {" "}
              (npm run dev nutzt Port 3001). In <code className="rounded bg-muted px-1">.env.local</code>{" "}
              <code className="rounded bg-muted px-1">NEXTAUTH_URL</code> auf dieselbe https-URL wie in der Adresszeile
              setzen, sonst bricht die Anmeldung ab.
            </p>
          )}
        </div>
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

      {isDev && (
        <div className="border-t border-border/60 bg-muted/20 px-3 py-2">
          <p className="mb-2 text-center text-[11px] leading-snug text-muted-foreground">
            Dev: Tunnel → Port <strong>3001</strong>. <code className="rounded bg-muted px-0.5">NEXTAUTH_URL</code> =
            aktuelle Basis-URL (https://…trycloudflare.com), sonst Session/Login kaputt.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === "onboarding" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                disabled={hostedLoading}
                onClick={() => void startHostedConnect()}
              >
                Fallback: Onboarding im Tab
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                disabled={hostedLoading}
                onClick={() => void startHostedExpressDashboard()}
              >
                Fallback: Express-Dashboard
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Mail, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"

const RESEND_COOLDOWN_SEC = 120

function VerifyEmailContent() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status, update } = useSession()
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const error = searchParams.get("error")

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return
    const emailConfirmedAt = (session.user as { emailConfirmedAt?: number | null }).emailConfirmedAt
    if (emailConfirmedAt) {
      router.replace("/onboarding")
    }
  }, [status, session, router])

  /** Session-JWT kann noch „unbestätigt“ sein, obwohl die DB nach Klick auf den Mail-Link schon passt. */
  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return
    const emailConfirmedAt = (session.user as { emailConfirmedAt?: number | null }).emailConfirmedAt
    if (emailConfirmedAt) return

    const sync = () => {
      void update({})
    }
    sync()
    const onVisible = () => {
      if (document.visibilityState === "visible") sync()
    }
    window.addEventListener("focus", sync)
    document.addEventListener("visibilitychange", onVisible)
    const interval = setInterval(sync, 4000)

    return () => {
      window.removeEventListener("focus", sync)
      document.removeEventListener("visibilitychange", onVisible)
      clearInterval(interval)
    }
  }, [status, session?.user, update])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleResend = async () => {
    if (resending || cooldown > 0) return
    setResending(true)
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" })
      const data = await res.json()

      if (res.ok) {
        setCooldown(data.retryAfterSec ?? RESEND_COOLDOWN_SEC)
        toast.success(data.message ?? "Verifizierungs-Mail wurde erneut gesendet.")
      } else {
        toast.error(data.error ?? t("toast.sendError"))
        if (data.retryAfterSec) setCooldown(data.retryAfterSec)
      }
    } catch {
      toast.error(t("toast.verifyNetworkError"))
    } finally {
      setResending(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card className="overflow-hidden border-[rgba(231,229,227,0.6)]">
          <CardHeader className="border-b border-[rgba(231,229,227,0.4)] bg-[rgba(245,245,244,0.2)] pb-6">
            <div className="flex items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[rgba(6,78,59,0.1)]">
                <Mail className="size-7 text-primary" />
              </div>
            </div>
            <h1 className="mt-4 text-center text-xl font-bold text-foreground">
              E-Mail bestätigen
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Fast geschafft! Klicke auf den Link in deiner E-Mail, um dein Konto zu aktivieren.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {error === "expired" && (
              <div className="rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] p-4 text-sm text-amber-800 dark:text-amber-200">
                Der Link ist abgelaufen. Fordere unten eine neue E-Mail an.
              </div>
            )}
            {error === "invalid" && (
              <div className="rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] p-4 text-sm text-destructive">
                Ungültiger oder bereits verwendeter Link. Fordere bei Bedarf eine neue E-Mail an.
              </div>
            )}

            <p className="text-sm leading-relaxed text-muted-foreground">
              Wir haben dir eine E-Mail mit einem Bestätigungslink geschickt. Prüfe auch deinen Spam-Ordner.
            </p>

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
              >
                {resending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {cooldown > 0
                  ? `Erneut senden in ${cooldown}s`
                  : "E-Mail erneut senden"}
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Abmelden
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Keine E-Mail erhalten? Warte 2 Minuten und klicke auf „E-Mail erneut senden“.
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}

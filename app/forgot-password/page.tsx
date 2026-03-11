"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function ForgotPasswordPage() {
  const { data: session } = useSession()
  const [email, setEmail] = useState("")
  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email)
  }, [session?.user?.email])
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState("")
  const { t } = useI18n()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!email) {
      setError(t("forgot.errorEmpty"))
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        setIsSent(true)
        toast.success(t("forgot.successTitle"))
      } else {
        setError(data.error || "Fehler beim Senden.")
      }
    } catch {
      setError(t("forgot.errorNetwork"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-40">
      <Link
        href="/"
        className="absolute left-4 top-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        <span className="hidden sm:inline">{t("common.startPage")}</span>
      </Link>

      <div className="absolute right-4 top-4">
        <LanguageSwitcher variant="compact" />
      </div>

      <Link href="/" className="mb-6 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
          <span className="text-sm font-bold text-primary-foreground">di</span>
        </div>
        <span className="text-lg font-bold text-foreground">
          di<span className="text-accent">Ai</span>way
        </span>
      </Link>

      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
            <Mail className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-balance">
            {t("forgot.title")}
          </h1>
          <p className="text-center text-sm text-muted-foreground leading-relaxed">
            {isSent ? t("forgot.descSent") : t("forgot.desc")}
          </p>
        </div>

        {isSent ? (
          <div className="flex flex-col gap-6">
            {/* Success state */}
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-8">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="size-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{t("forgot.successTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t("forgot.successDesc", { email })}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="h-12 w-full rounded-xl"
              onClick={() => { setIsSent(false); setEmail("") }}
            >
              {t("forgot.retry")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("forgot.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("forgot.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl"
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                {t("forgot.submitting")}
              </>
            ) : (
              <>
                <Mail className="size-4" />
                {t("forgot.submit")}
                </>
              )}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          {t("forgot.backToLogin")}
        </Link>
      </div>
    </div>
  )
}

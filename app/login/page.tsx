"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/lib/app-context"
import { toast } from "sonner"
import { ArrowLeft, Loader2, LogIn } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/profile"
  const { setIsLoggedIn } = useApp()
  const { t } = useI18n()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError(t("login.errorEmpty"))
      return
    }

    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError(t("login.errorInvalid"))
        setIsLoading(false)
      } else {
        // signIn succeeded -- cookie is now set.
        // Use full page navigation so the middleware sees the fresh cookie.
        setIsLoggedIn(true)
        window.location.href = callbackUrl
      }
    } catch {
      setError(t("login.errorNetwork"))
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
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
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
            <span className="font-jp text-2xl font-bold text-primary">匠</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground text-balance">{t("login.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("login.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("login.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("login.forgotPassword")}
            </Link>
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
                {t("login.submitting")}
              </>
            ) : (
              <>
                <LogIn className="size-4" />
                {t("login.submit")}
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("login.register")}
          </Link>
        </p>
      </div>
    </div>
  )
}

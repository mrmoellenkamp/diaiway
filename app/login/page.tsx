"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { signIn, signOut } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/lib/app-context"
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  // Only use callbackUrl if explicitly set (user was redirected from a protected page)
  const explicitCallback = searchParams.get("callbackUrl")
  const reasonTimeout = searchParams.get("reason") === "timeout"
  const { setIsLoggedIn } = useApp()
  const { t } = useI18n()

  // Bei Timeout-Redirect: Client-Session leeren, damit Avatar/Profil nicht mehr erreichbar sind
  useEffect(() => {
    if (reasonTimeout) {
      signOut({ redirect: false })
    }
  }, [reasonTimeout])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Honeypot — filled by bots, empty for real users
  const honeypotRef = useRef<HTMLInputElement>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Silently abort if honeypot is filled
    if (honeypotRef.current?.value) return

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
      })

      if (result?.error) {
        if (result.error.includes("TOO_MANY_ATTEMPTS")) {
          const sec = result.error.split(":")[1]
          const min = Math.ceil(Number(sec) / 60)
          setError(t("login.tooManyAttempts").replace("{min}", String(min)))
        } else if (result.error.includes("DB_ERROR")) {
          // Datenbankverbindungsfehler – Passwort ist korrekt, Server hat Probleme
          setError(t("login.errorNetwork"))
        } else {
          setError(t("login.errorInvalid"))
        }
        setIsLoading(false)
      } else {
        setIsLoggedIn(true)

        // If user was sent here from a protected page, honour that redirect
        if (explicitCallback) {
          window.location.href = explicitCallback
          return
        }

        // Otherwise route by role — fetch fresh session to read appRole & role
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()
        const role    = sessionData?.user?.role    ?? "user"
        const appRole = sessionData?.user?.appRole ?? "shugyo"

        if (role === "admin") {
          window.location.href = "/admin"
        } else if (appRole === "takumi") {
          window.location.href = "/profile"
        } else {
          // Shugyo → categories
          window.location.href = "/categories"
        }
      }
    } catch {
      setError(t("login.errorNetwork"))
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-safe pt-safe">
      <Link
        href="/"
        className="absolute left-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        <ArrowLeft className="size-5" />
        <span className="hidden sm:inline">{t("common.startPage")}</span>
      </Link>

      <div className="absolute right-4" style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}>
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
          {reasonTimeout && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm font-medium text-amber-700 dark:text-amber-400">
              {t("login.timeoutMessage")}
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
          {/* Honeypot — visually hidden, keyboard-unreachable */}
          <input
            ref={honeypotRef}
            name="_hp"
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }}
          />

          {/* E-Mail */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("login.email")}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl"
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
              required
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("login.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl pr-11"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? t("aria.hidePassword") : t("aria.showPassword")}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
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

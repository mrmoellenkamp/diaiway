"use client"

import { useState, useRef } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleSelector } from "@/components/role-selector"
import { useApp } from "@/lib/app-context"
import { toast } from "sonner"
import type { UserRole } from "@/lib/types"
import { Suspense } from "react"
import { ArrowLeft, Eye, EyeOff, Loader2, UserPlus } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

// ─── Password strength ──────────────────────────────────────────────────────

type Strength = 0 | 1 | 2 | 3 | 4

function calcStrength(pw: string): Strength {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  // Map 0-5 → 0-4
  return Math.min(4, score) as Strength
}

const STRENGTH_LABELS: Record<Strength, string> = {
  0: "",
  1: "Schwach",
  2: "Mittel",
  3: "Gut",
  4: "Stark",
}
const STRENGTH_COLORS: Record<Strength, string> = {
  0: "bg-muted",
  1: "bg-destructive",
  2: "bg-amber",
  3: "bg-yellow-400",
  4: "bg-green-500",
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = calcStrength(password)
  if (!password) return null
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              level <= strength ? STRENGTH_COLORS[strength] : "bg-muted"
            }`}
          />
        ))}
      </div>
      {strength > 0 && (
        <p className={`text-[11px] font-medium ${
          strength <= 1 ? "text-destructive" :
          strength === 2 ? "text-amber" :
          strength === 3 ? "text-yellow-500" : "text-green-600"
        }`}>
          {STRENGTH_LABELS[strength]}
        </p>
      )}
    </div>
  )
}

// ─── Form ───────────────────────────────────────────────────────────────────

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setRole, setIsLoggedIn } = useApp()
  const presetRole = searchParams.get("role") as UserRole | null
  const { t } = useI18n()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(presetRole)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Honeypot ref — bots fill this, humans don't
  const honeypotRef = useRef<HTMLInputElement>(null)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!selectedRole) {
      toast.error(t("register.selectRole"))
      return
    }
    if (!name || !email || !password || !confirmPassword) {
      setError(t("register.errorEmpty"))
      return
    }
    if (password.length < 8) {
      setError(t("register.errorPasswordLength"))
      return
    }
    if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setError(t("register.errorPasswordWeak"))
      return
    }
    if (password !== confirmPassword) {
      setError(t("register.errorPasswordMismatch"))
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          // Honeypot value — empty for real users
          _hp: honeypotRef.current?.value ?? "",
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t("register.errorNetwork"))
        setIsLoading(false)
        return
      }

      // Auto-login after registration
      const signInResult = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      })

      if (signInResult?.error) {
        setError(t("register.errorSignIn"))
        setIsLoading(false)
        router.push("/login")
        return
      }

      setRole(selectedRole)
      setIsLoggedIn(true)
      toast.success(t("register.success"))
      window.location.href = "/profile"
    } catch {
      setError(t("register.errorNetwork"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
          <span className="font-jp text-2xl font-bold text-primary">匠</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground text-balance">{t("register.title")}</h1>
        <p className="text-sm text-muted-foreground text-center">{t("register.subtitle")}</p>
      </div>

      <RoleSelector selected={selectedRole} onSelect={setSelectedRole} />

      <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>
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

        {/* Name */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("register.name")}</Label>
          <Input
            id="name"
            placeholder={t("register.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-xl"
            autoComplete="name"
            required
          />
        </div>

        {/* E-Mail */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="reg-email">{t("register.email")}</Label>
          <Input
            id="reg-email"
            type="email"
            inputMode="email"
            placeholder={t("register.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl"
            autoComplete="email"
            autoCapitalize="none"
            required
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="reg-password">{t("register.password")}</Label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              placeholder={t("register.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl pr-11"
              autoComplete="new-password"
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
          <PasswordStrengthBar password={password} />
          <p className="text-[11px] text-muted-foreground">{t("register.passwordHint")}</p>
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="reg-confirm">{t("register.confirmPassword")}</Label>
          <div className="relative">
            <Input
              id="reg-confirm"
              type={showConfirm ? "text" : "password"}
              placeholder={t("register.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`h-12 rounded-xl pr-11 ${
                confirmPassword && confirmPassword !== password
                  ? "border-destructive focus-visible:ring-destructive/30"
                  : ""
              }`}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirm ? t("aria.hidePassword") : t("aria.showPassword")}
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== password && (
            <p className="text-[11px] text-destructive">{t("register.errorPasswordMismatch")}</p>
          )}
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
              {t("register.submitting")}
            </>
          ) : (
            <>
              <UserPlus className="size-4" />
              {t("register.submit")}
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("register.hasAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("register.login")}
        </Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-safe">
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

      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  )
}

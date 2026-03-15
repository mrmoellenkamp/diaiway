"use client"

import { useState, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const { t } = useI18n()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isReset, setIsReset] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!password || password.length < 6) {
      setError(t("reset.passwordMinLength"))
      return
    }

    if (password !== confirmPassword) {
      setError(t("register.errorPasswordMismatch"))
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (res.ok) {
        setIsReset(true)
        toast.success(t("reset.success"))
      } else {
        setError(data.error || t("reset.resetError"))
      }
    } catch {
      setError(t("common.networkError"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-safe">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-balance">
            {isReset ? t("reset.titleSuccess") : t("reset.title")}
          </h1>
          <p className="text-center text-sm text-muted-foreground leading-relaxed">
            {isReset
              ? t("reset.successDesc")
              : t("reset.desc")}
          </p>
        </div>

        {isReset ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-8">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="size-8 text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground leading-relaxed">
                {t("reset.successDetail")}
              </p>
            </div>

            <Button asChild className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-md shadow-primary/20">
              <Link href="/login">{t("reset.loginNow")}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t("reset.newPassword")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("reset.minChars")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl pr-12"
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t("aria.hidePassword") : t("aria.showPassword")}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">{t("reset.confirmLabel")}</Label>
              <Input
                id="confirm"
                type="password"
                placeholder={t("reset.confirmPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 rounded-xl"
                autoComplete="new-password"
                required
              />
            </div>

            {/* Password strength hint */}
            {password.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        password.length >= level * 3
                          ? password.length >= 12
                            ? "bg-primary"
                            : password.length >= 8
                              ? "bg-accent"
                              : "bg-amber-400"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {password.length >= 12 ? t("reset.strengthVeryStrong") : password.length >= 8 ? t("reset.strengthStrong") : password.length >= 6 ? t("reset.strengthOk") : t("reset.strengthShort")}
                </span>
              </div>
            )}

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
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  {t("reset.saveButton")}
                </>
              )}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
          {t("reset.backToLogin")}
        </Link>
      </div>
    </div>
  )
}

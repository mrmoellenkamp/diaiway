"use client"

import { useState } from "react"
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
import { ArrowLeft, Loader2, UserPlus } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setRole, setIsLoggedIn } = useApp()
  const presetRole = searchParams.get("role") as UserRole | null
  const { t } = useI18n()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(presetRole)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!selectedRole) {
      toast.error(t("register.selectRole"))
      return
    }
    if (!name || !email || !password) {
      setError(t("register.errorEmpty"))
      return
    }
    if (password.length < 6) {
      setError(t("register.errorPassword"))
      return
    }

    setIsLoading(true)
    try {
      // 1. Register user in MongoDB
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Registrierung fehlgeschlagen.")
        setIsLoading(false)
        return
      }

      // 2. Auto-login after registration
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
      // Full page navigation so middleware sees the fresh session cookie
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

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="reg-email">{t("register.email")}</Label>
          <Input
            id="reg-email"
            type="email"
            placeholder={t("register.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reg-password">{t("register.password")}</Label>
          <Input
            id="reg-password"
            type="password"
            placeholder={t("register.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl"
            autoComplete="new-password"
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

      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  )
}

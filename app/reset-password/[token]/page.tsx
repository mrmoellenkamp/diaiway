"use client"

import { useState, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react"

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

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
      setError("Das Passwort muss mindestens 6 Zeichen lang sein.")
      return
    }

    if (password !== confirmPassword) {
      setError("Die Passwoerter stimmen nicht ueberein.")
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
        toast.success("Passwort erfolgreich geaendert!")
      } else {
        setError(data.error || "Fehler beim Zuruecksetzen.")
      }
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-balance">
            {isReset ? "Passwort geaendert!" : "Neues Passwort vergeben"}
          </h1>
          <p className="text-center text-sm text-muted-foreground leading-relaxed">
            {isReset
              ? "Du kannst dich jetzt mit deinem neuen Passwort anmelden."
              : "Waehle ein sicheres neues Passwort fuer dein diAiway-Konto."}
          </p>
        </div>

        {isReset ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-8">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="size-8 text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground leading-relaxed">
                Dein Passwort wurde erfolgreich geaendert. Dein Konto ist wieder sicher.
              </p>
            </div>

            <Button asChild className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-md shadow-primary/20">
              <Link href="/login">Jetzt anmelden</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Neues Passwort</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mindestens 6 Zeichen"
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
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">Passwort bestaetigen</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Passwort erneut eingeben"
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
                  {password.length >= 12 ? "Sehr stark" : password.length >= 8 ? "Stark" : password.length >= 6 ? "OK" : "Zu kurz"}
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
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  Passwort speichern
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
          Zurueck zum Login
        </Link>
      </div>
    </div>
  )
}

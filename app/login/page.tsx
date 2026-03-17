"use client"

import { Suspense, useEffect, useRef, useState, useCallback } from "react"
import { signOut, getCsrfToken } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/lib/app-context"
import {
  ArrowLeft, Eye, EyeOff, Loader2, LogIn,
  Fingerprint, ScanFace, ChevronRight, Check,
} from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Capacitor } from "@capacitor/core"
import {
  checkBiometricAvailable,
  verifyBiometric,
  getBiometricCredentials,
  saveBiometricCredentials,
  getLastUser,
  saveLastUser,
} from "@/hooks/use-native-bridge"

// ─── Biometric icon helper ────────────────────────────────────────────────────

/** biometryType: 2 = Face ID / 4 = FaceAuthentication → ScanFace icon, rest → Fingerprint */
function BiometricIcon({ biometryType, className }: { biometryType: number; className?: string }) {
  if (biometryType === 2 || biometryType === 4) return <ScanFace className={className} />
  return <Fingerprint className={className} />
}

function isFaceId(biometryType: number) {
  return biometryType === 2 || biometryType === 4
}

// ─── Helper: determine avatar initials ───────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

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

// ─── Main content ─────────────────────────────────────────────────────────────

function LoginContent() {
  const searchParams = useSearchParams()
  const explicitCallback = searchParams.get("callbackUrl")
  const reasonTimeout = searchParams.get("reason") === "timeout"
  const { setIsLoggedIn } = useApp()
  const { t } = useI18n()
  const isNative = Capacitor.isNativePlatform()

  // ── Sign out stale client session on timeout redirect
  useEffect(() => {
    if (reasonTimeout) signOut({ redirect: false })
  }, [reasonTimeout])

  // ── Form state
  const [email,        setEmail]        = useState("")
  const [password,     setPassword]     = useState("")
  const [error,        setError]        = useState("")
  const [isLoading,    setIsLoading]    = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const honeypotRef = useRef<HTMLInputElement>(null)

  // ── Quick-login / biometric state (native only)
  const [quickUser,        setQuickUser]        = useState<{ email: string; name: string } | null>(null)
  const [biometryType,     setBiometryType]     = useState(0)   // BiometryType enum (0 = none)
  const [hasBioCreds,      setHasBioCreds]      = useState(false)
  const [showQuickLogin,   setShowQuickLogin]   = useState(true) // dismissable
  const [biometricLoading, setBiometricLoading] = useState(false)

  // ── Post-login biometric-save prompt
  const [saveBioState,  setSaveBioState]  = useState<"hidden" | "asking" | "saving">("hidden")
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null)
  const [pendingCreds,  setPendingCreds]  = useState<{ email: string; password: string } | null>(null)

  // ── On mount: load last user + check biometric on native
  useEffect(() => {
    if (!isNative) return
    ;(async () => {
      const lastUser = await getLastUser()
      if (!lastUser) return
      setQuickUser(lastUser)

      const creds = await getBiometricCredentials()
      if (!creds) return
      setHasBioCreds(true)

      const bio = await checkBiometricAvailable()
      if (bio.available) {
        setBiometryType(Number(bio.type) || 0)
      }
    })()
  }, [isNative])

  // ── Navigate after login (role-based)
  const navigateAfterLogin = useCallback(
    async (navUrl?: string) => {
      if (navUrl) { window.location.href = navUrl; return }
      if (explicitCallback) { window.location.href = explicitCallback; return }
      const r = await fetch("/api/auth/session", { credentials: "include" })
      const d = await r.json()
      const role    = d?.user?.role    ?? "user"
      const appRole = d?.user?.appRole ?? "shugyo"
      if (role === "admin")        window.location.href = "/admin"
      else if (appRole === "takumi") window.location.href = "/profile"
      else                           window.location.href = "/categories"
    },
    [explicitCallback]
  )

  // ── Core login action (shared by form + biometric replay)
  const performLogin = useCallback(
    async (loginEmail: string, loginPassword: string): Promise<{ ok: boolean; navUrl?: string; name?: string }> => {
      const csrfToken = await getCsrfToken()
      const body = new URLSearchParams({
        csrfToken: csrfToken ?? "",
        email:       loginEmail.toLowerCase().trim(),
        password:    loginPassword.trim(),
        callbackUrl: explicitCallback || "/categories",
        json:        "true",
      })
      const res  = await fetch("/api/auth/callback/credentials", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include",
        body: body.toString(),
      })
      const data = await res.json().catch(() => ({}))
      const err  = data?.error ?? data?.cause ?? (res.ok ? null : "CredentialsSignin")
      if (err) return { ok: false }

      // Read session for name + nav target
      const sessionRes  = await fetch("/api/auth/session", { credentials: "include" })
      const sessionData = await sessionRes.json()
      const userName    = sessionData?.user?.username ?? sessionData?.user?.name ?? loginEmail
      const role        = sessionData?.user?.role    ?? "user"
      const appRole     = sessionData?.user?.appRole ?? "shugyo"
      const navUrl =
        data?.url          ? data.url :
        explicitCallback   ? explicitCallback :
        role === "admin"   ? "/admin" :
        appRole === "takumi" ? "/profile" : "/categories"

      return { ok: true, navUrl, name: userName }
    },
    [explicitCallback]
  )

  // ── Handle manual form submit
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (honeypotRef.current?.value) return
    if (!email || !password) { setError(t("login.errorEmpty")); return }

    setIsLoading(true)
    try {
      const { ok, navUrl, name } = await performLogin(email, password)
      if (!ok) {
        setError(t("login.errorInvalid"))
        setIsLoading(false)
        return
      }
      setIsLoggedIn(true)

      // Save last user for quick login next time
      if (isNative && name) await saveLastUser({ email: email.toLowerCase().trim(), name })

      // On native: check if biometric can be offered for next time
      if (isNative && !hasBioCreds) {
        const bio = await checkBiometricAvailable()
        if (bio.available) {
          setPendingCreds({ email: email.toLowerCase().trim(), password: password.trim() })
          setPendingNavUrl(navUrl ?? null)
          setBiometryType(Number(bio.type) || 0)
          setSaveBioState("asking")
          return // wait for user response in prompt
        }
      }

      navigateAfterLogin(navUrl)
    } catch {
      setError(t("login.errorNetwork"))
      setIsLoading(false)
    }
  }

  // ── Handle biometric quick login
  async function handleBiometricLogin() {
    setBiometricLoading(true)
    setError("")
    try {
      const verified = await verifyBiometric(t("login.biometricButton"))
      if (!verified) { setBiometricLoading(false); return }

      const creds = await getBiometricCredentials()
      if (!creds) {
        setError(t("login.biometricError"))
        setHasBioCreds(false)
        setBiometricLoading(false)
        setShowQuickLogin(false)
        return
      }

      const { ok, navUrl, name } = await performLogin(creds.username, creds.password)
      if (!ok) {
        setError(t("login.biometricError"))
        setBiometricLoading(false)
        setShowQuickLogin(false) // fall through to manual form
        return
      }
      setIsLoggedIn(true)
      if (name && quickUser) await saveLastUser({ email: creds.username, name })
      navigateAfterLogin(navUrl)
    } catch {
      setError(t("login.biometricError"))
      setBiometricLoading(false)
      setShowQuickLogin(false)
    }
  }

  // ── Handle biometric save prompt responses
  async function handleBiometricSaveYes() {
    if (!pendingCreds) { navigateAfterLogin(pendingNavUrl ?? undefined); return }
    setSaveBioState("saving")
    try {
      await saveBiometricCredentials(pendingCreds.email, pendingCreds.password)
      setHasBioCreds(true)
    } catch { /* ignore – not critical */ }
    navigateAfterLogin(pendingNavUrl ?? undefined)
  }

  function handleBiometricSaveNo() {
    navigateAfterLogin(pendingNavUrl ?? undefined)
  }

  // ── Dismiss quick login (user wants different account)
  function dismissQuickLogin() {
    setShowQuickLogin(false)
    setEmail("")
    setPassword("")
    setError("")
  }

  // ── Derived flags
  const showBiometricCard = isNative && !!quickUser && hasBioCreds && biometryType > 0 && showQuickLogin
  const showPrefilledHint = isNative && !!quickUser && (!hasBioCreds || !showQuickLogin) && showQuickLogin

  // ── Error message translator (for form errors from manual login)
  function getErrorMessage(rawErr: string) {
    if (rawErr.includes("TOO_MANY_ATTEMPTS")) {
      const sec = rawErr.split(":")[1]
      const min = Math.ceil(Number(sec) / 60)
      return t("login.tooManyAttempts").replace("{min}", String(min))
    }
    if (rawErr.includes("DB_ERROR") || rawErr.includes("CSRF")) return t("login.errorNetwork")
    return t("login.errorInvalid")
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 pb-safe pt-safe">
      {/* Back button */}
      <Link
        href="/"
        className="absolute left-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}
      >
        <ArrowLeft className="size-5" />
        <span className="hidden sm:inline">{t("common.startPage")}</span>
      </Link>

      {/* Language switcher */}
      <div className="absolute right-4" style={{ top: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        <LanguageSwitcher variant="compact" />
      </div>

      {/* Logo */}
      <Link href="/" className="mb-6 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
          <span className="text-sm font-bold text-primary-foreground">di</span>
        </div>
        <span className="text-lg font-bold text-foreground">
          di<span className="text-accent">Ai</span>way
        </span>
      </Link>

      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* ── Timeout banner ── */}
        {reasonTimeout && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm font-medium text-amber-700 dark:text-amber-400">
            {t("login.timeoutMessage")}
          </p>
        )}

        {/* ══════════════════════════════════════════════════════════════
            QUICK LOGIN CARD (native only, when stored biometric creds)
        ══════════════════════════════════════════════════════════════ */}
        {showBiometricCard && quickUser && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-7 text-center shadow-sm">
            {/* Avatar */}
            <div className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground shadow-md shadow-primary/30">
              {initials(quickUser.name)}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("login.title")}
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">{quickUser.name}</p>
              <p className="text-xs text-muted-foreground">{quickUser.email}</p>
            </div>

            {/* Biometric button */}
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
            >
              {biometricLoading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <BiometricIcon biometryType={biometryType} className="size-6" />
              )}
              {isFaceId(biometryType) ? t("login.biometricButton") : t("login.biometricButtonFingerprint")}
            </button>

            {/* Error */}
            {error && (
              <p className="w-full rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            {/* Separator */}
            <div className="flex w-full items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{t("login.biometricOr")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* "Not you?" link */}
            <button
              type="button"
              onClick={dismissQuickLogin}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("login.biometricNotYou").replace("{name}", quickUser.name.split(" ")[0])}
              <span className="font-medium text-primary hover:underline">
                {t("login.biometricSwitch")}
              </span>
              <ChevronRight className="size-3.5 shrink-0 text-primary" />
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PREFILLED HINT (native, has lastUser but no biometric)
        ══════════════════════════════════════════════════════════════ */}
        {showPrefilledHint && quickUser && !showBiometricCard && (
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initials(quickUser.name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{quickUser.name}</p>
                <p className="text-xs text-muted-foreground">{quickUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissQuickLogin}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("login.biometricSwitch")}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            MANUAL LOGIN FORM (always shown when biometric card not active)
        ══════════════════════════════════════════════════════════════ */}
        {!showBiometricCard && (
          <>
            {/* Header (only when no prefilled hint) */}
            {!showPrefilledHint && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
                  <span className="font-jp text-2xl font-bold text-primary">匠</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground text-balance">{t("login.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
              {/* Honeypot */}
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
                  autoFocus={!showPrefilledHint}
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
                <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  {t("login.forgotPassword")}
                </Link>
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {getErrorMessage(error) || error}
                </p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
              >
                {isLoading ? (
                  <><Loader2 className="size-4 animate-spin" />{t("login.submitting")}</>
                ) : (
                  <><LogIn className="size-4" />{t("login.submit")}</>
                )}
              </Button>
            </form>
          </>
        )}

        {/* Register link */}
        <p className="text-center text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("login.register")}
          </Link>
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          BIOMETRIC SAVE PROMPT (bottom sheet, shown after manual login)
      ══════════════════════════════════════════════════════════════ */}
      {saveBioState !== "hidden" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-safe">
          <div className="w-full max-w-sm rounded-t-3xl bg-background px-6 py-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
                <BiometricIcon biometryType={biometryType} className="size-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("login.biometricSaveTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("login.biometricSaveDesc")}</p>
              </div>
              <div className="flex w-full flex-col gap-2">
                <Button
                  className="h-12 w-full gap-2 rounded-xl bg-primary text-primary-foreground"
                  onClick={handleBiometricSaveYes}
                  disabled={saveBioState === "saving"}
                >
                  {saveBioState === "saving" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {t("login.biometricSaveYes")}
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 w-full rounded-xl text-muted-foreground"
                  onClick={handleBiometricSaveNo}
                  disabled={saveBioState === "saving"}
                >
                  {t("login.biometricSaveNo")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

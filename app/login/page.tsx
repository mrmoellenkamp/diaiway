"use client"

import { Suspense, useEffect, useRef, useState, useCallback } from "react"
import { signOut, signIn, getSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
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
  saveStayLoggedIn,
} from "@/hooks/use-native-bridge"
import { shouldUseHardNavigationAfterLogin, webkitCookieSettleDelayMs } from "@/lib/browser-auth-nav"

// ─── Biometric icon helper ────────────────────────────────────────────────────

/** biometryType: 1/3/5 = Touch/Fingerprint → Fingerprint icon, everything else (incl. 0=unknown) → ScanFace */
function BiometricIcon({ biometryType, className }: { biometryType: number; className?: string }) {
  if (biometryType === 1 || biometryType === 3 || biometryType === 5) return <Fingerprint className={className} />
  return <ScanFace className={className} />
}

function isFaceId(biometryType: number) {
  return biometryType !== 1 && biometryType !== 3 && biometryType !== 5
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
  const router = useRouter()
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
      setEmail(lastUser.email) // pre-fill email so only password is needed

      const bio = await checkBiometricAvailable()
      if (bio.available) {
        setBiometryType(Number(bio.type) || 0)
      }

      const creds = await getBiometricCredentials()
      if (creds) setHasBioCreds(true)
    })()
  }, [isNative])

  // ── Navigate after login (role-based)
  // Never go to "/" on native – root page signs out when stayLoggedIn=false, causing a loop
  const navigateAfterLogin = useCallback(
    async (navUrl?: string) => {
      const useHardNav = !isNative && shouldUseHardNavigationAfterLogin()
      const settleMs = webkitCookieSettleDelayMs()
      const hardGo = async (absoluteUrl: string) => {
        if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs))
        window.location.assign(absoluteUrl)
      }

      const target = navUrl || explicitCallback
      if (target && target !== "/") {
        // In Capacitor use client-side routing for in-app paths to avoid
        // hard WebView reloads that can look like an app close on Android.
        if (target.startsWith("/")) {
          if (useHardNav) {
            await hardGo(`${window.location.origin}${target}`)
            return
          }
          router.replace(target)
          router.refresh()
        } else if (target.startsWith(window.location.origin)) {
          const path = target.slice(window.location.origin.length) || "/"
          const normalized = path.startsWith("/") ? path : `/${path}`
          if (useHardNav) {
            await hardGo(`${window.location.origin}${normalized}`)
            return
          }
          router.replace(path)
          router.refresh()
        } else {
          window.location.href = target
        }
        return
      }
      const r = await fetch("/api/auth/session", { credentials: "include" })
      const d = await r.json()
      const role    = d?.user?.role    ?? "user"
      const appRole = d?.user?.appRole ?? "shugyo"
      const path =
        role === "admin" ? "/admin" : appRole === "takumi" ? "/profile" : "/categories"
      if (useHardNav) {
        await hardGo(`${window.location.origin}${path}`)
        return
      }
      router.replace(path)
      router.refresh()
    },
    [explicitCallback, router, isNative]
  )

  // ── Core login action (shared by form + biometric replay)
  const performLogin = useCallback(
    async (
      loginEmail: string,
      loginPassword: string
    ): Promise<{ ok: boolean; navUrl?: string; name?: string; rawError?: string }> => {
      const callbackUrl = explicitCallback || "/categories"

      // Offizieller Client-Flow (nicht roher fetch) — bessere CSRF/Cookie-Abstimmung, v. a. WebKit/Safari.
      const result = await signIn("credentials", {
        email: loginEmail.toLowerCase().trim(),
        password: loginPassword.trim(),
        redirect: false,
        callbackUrl,
      })

      const err =
        (result as { error?: string } | undefined)?.error ??
        ((result as { ok?: boolean } | undefined)?.ok === false ? "CredentialsSignin" : undefined)
      if (err) return { ok: false, rawError: err }

      await getSession()

      const sessionRes = await fetch("/api/auth/session", { credentials: "include" })
      const sessionData = await sessionRes.json()
      const userName = sessionData?.user?.username ?? sessionData?.user?.name ?? loginEmail
      const role = sessionData?.user?.role ?? "user"
      const appRole = sessionData?.user?.appRole ?? "shugyo"

      const rolePath =
        role === "admin" ? "/admin" : appRole === "takumi" ? "/profile" : "/categories"
      let navUrl = explicitCallback && explicitCallback !== "/" ? explicitCallback : rolePath
      const signInUrl = (result as { url?: string | null } | undefined)?.url
      if (
        signInUrl &&
        signInUrl.startsWith(window.location.origin) &&
        !signInUrl.includes("/api/auth/")
      ) {
        const p = signInUrl.slice(window.location.origin.length) || "/"
        navUrl = p.startsWith("/") ? p : `/${p}`
      }

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
      const { ok, navUrl, name, rawError } = await performLogin(email, password)
      if (!ok) {
        setError(getErrorMessage(rawError || "CredentialsSignin"))
        setIsLoading(false)
        return
      }
      // Save last user for quick login next time
      if (isNative && name) await saveLastUser({ email: email.toLowerCase().trim(), name })

      // On native: offer "stay logged in?" choice before navigating away
      if (isNative) {
        const bio = await checkBiometricAvailable()
        if (bio.available) {
          setPendingCreds({ email: email.toLowerCase().trim(), password: password.trim() })
          setPendingNavUrl(navUrl ?? null)
          setBiometryType(Number(bio.type) || 0)
          setSaveBioState("asking")
          return // navigate only after user responds
        }
      }

      setIsLoggedIn(true)
      navigateAfterLogin(navUrl)
    } catch {
      setError(t("login.errorNetwork"))
      setIsLoading(false)
    }
  }

  // ── Handle biometric quick login
  // On iOS, getCredentials triggers Face ID when credentials are stored with biometric protection.
  // Call getCredentials first; verifyIdentity as fallback only when no creds (shouldn't happen if card is shown).
  async function handleBiometricLogin() {
    setBiometricLoading(true)
    setError("")
    try {
      let creds = await getBiometricCredentials()
      if (!creds) {
        const verified = await verifyBiometric(t("login.biometricButton"))
        if (!verified) { setBiometricLoading(false); return }
        creds = await getBiometricCredentials()
      }
      if (!creds) {
        setError(t("login.biometricError"))
        setHasBioCreds(false)
        setBiometricLoading(false)
        setShowQuickLogin(false)
        return
      }

      const { ok, navUrl, name, rawError } = await performLogin(creds.username, creds.password)
      if (!ok) {
        setError(rawError ? getErrorMessage(rawError) : t("login.biometricError"))
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

  // ── Handle stay-logged-in prompt: "Direkt einloggen" (app opens on profile)
  async function handleStayYes() {
    setSaveBioState("saving")
    try {
      await saveStayLoggedIn(true)
      if (pendingCreds) {
        await saveBiometricCredentials(pendingCreds.email, pendingCreds.password)
        setHasBioCreds(true)
      }
      // Cookie for middleware: skip inactivity timeout when stay-logged-in
      if (typeof document !== "undefined") {
        document.cookie = "diaiway_stay=1; path=/; max-age=31536000; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "")
      }
    } catch { /* ignore */ }
    setIsLoggedIn(true)
    const target = (pendingNavUrl && pendingNavUrl !== "/") ? pendingNavUrl : undefined
    navigateAfterLogin(target)
  }

  // ── Handle stay-logged-in prompt: "Immer Anmeldeseite zeigen" (login page + Face ID)
  async function handleStayNo() {
    setSaveBioState("saving")
    try {
      await saveStayLoggedIn(false)
      if (pendingCreds) {
        await saveBiometricCredentials(pendingCreds.email, pendingCreds.password)
        setHasBioCreds(true)
      }
      if (typeof document !== "undefined") {
        document.cookie = "diaiway_stay=0; path=/; max-age=31536000; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "")
      }
    } catch { /* ignore */ }
    setIsLoggedIn(true)
    const target = (pendingNavUrl && pendingNavUrl !== "/") ? pendingNavUrl : undefined
    navigateAfterLogin(target)
  }

  // ── Dismiss quick login (user wants different account)
  function dismissQuickLogin() {
    setShowQuickLogin(false)
    setEmail("")
    setPassword("")
    setError("")
  }

  // ── Derived flags
  // Show Face ID card if credentials are saved – don't require biometryType > 0 to avoid
  // false negatives when isAvailable() returns 0 transiently (e.g. after app restart)
  const showBiometricCard = isNative && !!quickUser && hasBioCreds && showQuickLogin
  const showPrefilledHint = isNative && !!quickUser && !hasBioCreds && showQuickLogin

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
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className="flex items-center justify-between">
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
            {biometryType > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BiometricIcon biometryType={biometryType} className="size-3.5 shrink-0 text-primary" />
                {isFaceId(biometryType)
                  ? t("login.biometricSetupHint")
                  : t("login.biometricSetupHintFingerprint")}
              </p>
            )}
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
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <h2 className="text-lg font-bold text-foreground">{t("login.stayTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("login.stayDesc")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleStayYes}
                  disabled={saveBioState === "saving"}
                  className="flex items-start gap-3 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 disabled:opacity-60"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    {saveBioState === "saving" ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t("login.stayYes")}</p>
                    <p className="text-xs text-muted-foreground">{t("login.stayYesDesc")}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleStayNo}
                  disabled={saveBioState === "saving"}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <BiometricIcon biometryType={biometryType} className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t("login.stayNo")}</p>
                    <p className="text-xs text-muted-foreground">{t("login.stayNoDesc")}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

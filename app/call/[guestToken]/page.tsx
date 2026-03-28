"use client"

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import type { Stripe } from "@stripe/stripe-js"
import { createStripeBrowserPromise } from "@/lib/stripe-client"
import { Loader2, ShieldCheck, User, Building2, CheckCircle2, AlertCircle, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import type { DailyCall } from "@daily-co/daily-js"

// ── Types ────────────────────────────────────────────────────────────────────

type InvoiceType = "privat" | "unternehmen"

interface InvoiceData {
  type: InvoiceType | ""
  fullName: string
  companyName: string
  street: string
  houseNumber: string
  zip: string
  city: string
  country: string
  email: string
  vatId: string
}

interface BookingInfo {
  id: string
  date: string
  startTime: string
  endTime: string
  totalPrice: unknown
  callType: string
  alreadyPaid?: boolean
  expert: { name: string; avatarUrl?: string | null }
}

interface WindowInfo {
  payOpenAt: string
  callStartAt: string
  callEndAt: string
  payCloseAt: string
  isOpen: boolean
  isExpired: boolean
  secondsUntilOpen: number
}

type Stage = "loading" | "too_early" | "expired" | "form" | "checkout" | "joining" | "in_call" | "success" | "error" | "already_paid"

// ── Main Component ───────────────────────────────────────────────────────────

export default function GuestCallPage({ params }: { params: Promise<{ guestToken: string }> }) {
  const { guestToken } = use(params)
  const { t, locale } = useI18n()
  const localeTag = locale === "de" ? "de-DE" : locale === "es" ? "es-ES" : "en-US"

  const formatPrice = useCallback(
    (price: unknown): string => {
      const n = Number(price)
      if (isNaN(n)) return "–"
      return n.toLocaleString(localeTag, { style: "currency", currency: "EUR" })
    },
    [localeTag]
  )

  const formatDate = useCallback(
    (dateStr: string): string => {
      try {
        const [y, m, d] = dateStr.split("-").map(Number)
        return new Date(y, m - 1, d).toLocaleDateString(localeTag, { day: "2-digit", month: "2-digit", year: "numeric" })
      } catch {
        return dateStr
      }
    },
    [localeTag]
  )

  const [stage, setStage] = useState<Stage>("loading")
  const [booking, setBooking] = useState<BookingInfo | null>(null)
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")

  // Form state
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    type: "",
    fullName: "",
    companyName: "",
    street: "",
    houseNumber: "",
    zip: "",
    city: "",
    country: "DE",
    email: "",
    vatId: "",
  })
  const [password, setPassword] = useState("")
  const [consentWithdrawal, setConsentWithdrawal] = useState(false)
  const [consentSnapshot, setConsentSnapshot] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)

  // Daily.co state
  const [dailyUrl, setDailyUrl] = useState<string | null>(null)
  const [dailyToken, setDailyToken] = useState<string | null>(null)
  const dailyCallRef = useRef<unknown>(null)

  // Load Stripe
  useEffect(() => {
    setStripePromise(createStripeBrowserPromise())
  }, [])

  // Load booking info
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/guest/checkout?guestToken=${encodeURIComponent(guestToken)}&locale=${encodeURIComponent(locale)}`
        )
        if (!res.ok) {
          setErrorMsg(t("guestCall.notFound"))
          setStage("error")
          return
        }
        const data = await res.json()
        const b: BookingInfo = data.booking
        const wi: WindowInfo | null = data.windowInfo ?? null
        setBooking(b)
        if (wi) setWindowInfo(wi)

        if (b.alreadyPaid) {
          setStage("already_paid")
        } else if (wi?.isExpired) {
          setStage("expired")
        } else if (wi && !wi.isOpen) {
          setCountdown(wi.secondsUntilOpen)
          setStage("too_early")
        } else {
          setStage("form")
        }
      } catch {
        setErrorMsg(t("guestCall.notFound"))
        setStage("error")
      }
    }
    load()
  }, [guestToken, t, locale])

  // Countdown: tick every second, reload when window opens
  useEffect(() => {
    if (stage !== "too_early") return
    if (countdown <= 0) {
      window.location.reload()
      return
    }
    const id = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          clearInterval(id)
          window.location.reload()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [stage, countdown])

  // Submit form → create Stripe session
  const handleSubmit = useCallback(async () => {
    setFormError("")
    if (!consentWithdrawal || !consentSnapshot) {
      setFormError(t("guestCall.consentRequired"))
      return
    }
    if (password && password.length < 8) {
      setFormError(t("guestCall.passwordMinLength"))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/guest/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestToken,
          invoiceData,
          password: password || null,
          consentWithdrawal,
          consentSnapshot,
          locale,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(typeof data.error === "string" ? data.error : t("guestCall.paymentCreateError"))
        setSubmitting(false)
        return
      }

      setClientSecret(data.clientSecret)
      setBookingId(data.bookingId)
      setStage("checkout")
    } catch {
      setFormError(t("guestCall.networkErrorRetry"))
    } finally {
      setSubmitting(false)
    }
  }, [guestToken, invoiceData, password, consentWithdrawal, consentSnapshot, t, locale])

  // Stripe onComplete callback
  const onCompleteRef = useRef<() => Promise<void>>(async () => {})
  const stableOnComplete = useCallback(() => onCompleteRef.current(), [])

  onCompleteRef.current = async () => {
    // Poll payment status (webhook may take a few seconds)
    for (let i = 0; i < 12; i++) {
      try {
        const res = await fetch(
          `/api/guest/checkout?guestToken=${encodeURIComponent(guestToken)}&locale=${encodeURIComponent(locale)}`
        )
        const data = await res.json()
        if (data.booking?.alreadyPaid || data.booking?.paymentStatus === "paid") {
          // Payment confirmed — join the Daily call
          setStage("joining")
          try {
            const meetingRes = await fetch("/api/guest/meeting", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ guestToken }),
            })
            if (meetingRes.ok) {
              const meetingData = await meetingRes.json()
              setDailyUrl(meetingData.url)
              setDailyToken(meetingData.token)
              setStage("in_call")
              return
            }
          } catch {
            // Fall through to success screen if Daily fails
          }

          // Fallback: show success + try auto-login
          setStage("success")
          try {
            const loginRes = await fetch(`/api/guest/auto-login?guestToken=${encodeURIComponent(guestToken)}`)
            const loginData = await loginRes.json()
            if (loginData.canAutoLogin && loginData.token) {
              const callbackUrl = bookingId ? `/session/${bookingId}` : "/home"
              setTimeout(() => {
                window.location.href = `/api/guest/signin?token=${encodeURIComponent(loginData.token)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
              }, 2000)
            }
          } catch { /* ignore */ }
          return
        }
      } catch {
        // continue polling
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    setStage("success")
  }

  const checkoutOptions = useMemo(
    () => (clientSecret ? { clientSecret, onComplete: stableOnComplete } : null),
    [clientSecret, stableOnComplete]
  )

  // ── Render ────────────────────────────────────────────────────────────────

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-slate-600">{t("guestCall.loading")}</span>
      </div>
    )
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-700">{errorMsg}</p>
        </div>
      </div>
    )
  }

  // ── Too early: payment link not yet active ──────────────────────────────────
  if (stage === "too_early") {
    const hh = Math.floor(countdown / 3600)
    const mm = Math.floor((countdown % 3600) / 60)
    const ss = countdown % 60
    const countdownStr = hh > 0
      ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
      : `${mm}:${String(ss).padStart(2, "0")}`
    const callStart = windowInfo?.callStartAt
      ? new Date(windowInfo.callStartAt).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })
      : booking?.startTime ?? ""
    const timeSuffix = t("guestCall.timeSuffix")
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">{t("guestCall.tooEarlyTitle")}</h2>
          <p className="text-slate-600 mb-1 text-sm">
            {t("guestCall.tooEarlyBody")}
          </p>
          <p className="text-slate-500 text-sm mb-6">
            {t("guestCall.callStartLabel")}{" "}
            <span className="font-medium text-slate-700">
              {callStart}
              {timeSuffix ? ` ${timeSuffix}` : ""}
            </span>
          </p>
          <div className="text-4xl font-bold tabular-nums text-primary mb-6">{countdownStr}</div>
          <p className="text-xs text-slate-400">{t("guestCall.autoReloadHint")}</p>
        </div>
      </div>
    )
  }

  // ── Expired ─────────────────────────────────────────────────────────────────
  if (stage === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <PhoneOff className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">{t("guestCall.expiredTitle")}</h2>
          <p className="text-slate-600 text-sm">
            {t("guestCall.expiredBody")}
          </p>
        </div>
      </div>
    )
  }

  if (stage === "already_paid") {
    const callActive = windowInfo
      ? windowInfo.isOpen
      : true  // if no windowInfo, assume it's open (backward compat)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-slate-700 mb-6">{t("guestCall.alreadyPaid")}</p>
          {callActive ? (
            bookingId ? (
              <a
                href={`/session/${bookingId}`}
                className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition"
              >
                {t("guestCall.joinCall")}
              </a>
            ) : (
              // Booking ID may be missing if user lands here fresh – use guestToken to fetch it
              <button
                onClick={async () => {
                  const res = await fetch(
                    `/api/guest/checkout?guestToken=${encodeURIComponent(guestToken)}&locale=${encodeURIComponent(locale)}`
                  )
                  const data = await res.json()
                  if (data.booking?.id) {
                    window.location.href = `/session/${data.booking.id}`
                  }
                }}
                className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition"
              >
                {t("guestCall.joinCall")}
              </button>
            )
          ) : windowInfo?.isExpired ? (
            <p className="text-sm text-slate-500">{t("guestCall.callPeriodExpired")}</p>
          ) : (
            <p className="text-sm text-slate-500">
              {t("guestCall.joinCallFromTime", {
                time:
                  windowInfo?.callStartAt
                    ? new Date(windowInfo.callStartAt).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })
                    : booking?.startTime ?? "",
              })}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (stage === "joining") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-slate-700 font-medium">{t("guestCall.paymentSuccess")}</p>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("guestCall.preparingVideoRoom")}
          </div>
        </div>
      </div>
    )
  }

  if (stage === "in_call" && dailyUrl && dailyToken) {
    return (
      <GuestVideoCall
        roomUrl={dailyUrl}
        token={dailyToken}
        guestName={invoiceData.fullName || invoiceData.companyName || booking?.expert?.name || t("guestCall.guestDefaultName")}
        guestToken={guestToken}
        onLeave={() => setStage("success")}
        dailyCallRef={dailyCallRef}
      />
    )
  }

  if (stage === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-slate-700">{t("guestCall.paymentSuccess")}</p>
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-4" />
        </div>
      </div>
    )
  }

  if (stage === "checkout" && clientSecret && stripePromise && checkoutOptions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-lg mx-auto pt-8">
          <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">{t("guestCall.title")}</h1>
          <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    )
  }

  // ── Form stage ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 pb-16">
      <div className="max-w-lg mx-auto pt-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          {booking?.expert?.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={booking.expert.avatarUrl} alt="" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
          )}
          <p className="text-sm text-slate-500">{t("guestCall.with")}</p>
          <h2 className="text-xl font-bold text-slate-800">{booking?.expert?.name}</h2>
          <div className="mt-3 flex justify-center gap-4 text-sm text-slate-600 flex-wrap">
            <span><span className="font-medium">{t("guestCall.date")}:</span> {booking ? formatDate(booking.date) : "–"}</span>
            <span><span className="font-medium">{t("guestCall.time")}:</span> {booking?.startTime}–{booking?.endTime}</span>
          </div>
        </div>

        {/* Preis – prominent wie Buchungsseite */}
        {booking && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">
                {(() => {
                  if (!booking.startTime || !booking.endTime) return t("guestCall.price")
                  const [sh, sm] = booking.startTime.split(":").map(Number)
                  const [eh, em] = booking.endTime.split(":").map(Number)
                  const dur = (eh * 60 + em) - (sh * 60 + sm)
                  return dur > 0
                    ? t("guestCall.durationLine", { minutes: dur, priceLabel: t("guestCall.price") })
                    : t("guestCall.price")
                })()}
              </p>
              <p className="text-2xl font-bold text-slate-900">{formatPrice(booking.totalPrice)}</p>
            </div>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="size-6 text-primary" />
            </div>
          </div>
        )}

        {/* Billing data */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">{t("guestCall.billing")}</h3>
          <p className="text-sm text-slate-500">{t("guestCall.billingDesc")}</p>

          {/* Invoice type */}
          <div className="flex gap-3">
            {(["privat", "unternehmen"] as InvoiceType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setInvoiceData((d) => ({ ...d, type }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                  invoiceData.type === type
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {type === "privat" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                {t(`guestCall.invoiceType.${type}`)}
              </button>
            ))}
          </div>

          {invoiceData.type && (
            <div className="grid grid-cols-2 gap-3">
              {invoiceData.type === "privat" && (
                <div className="col-span-2">
                  <input
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder={t("guestCall.placeholder.fullName")}
                    value={invoiceData.fullName}
                    onChange={(e) => setInvoiceData((d) => ({ ...d, fullName: e.target.value }))}
                  />
                </div>
              )}
              {invoiceData.type === "unternehmen" && (
                <>
                  <div className="col-span-2">
                    <input
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={t("guestCall.placeholder.companyName")}
                      value={invoiceData.companyName}
                      onChange={(e) => setInvoiceData((d) => ({ ...d, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={t("guestCall.placeholder.vatId")}
                      value={invoiceData.vatId}
                      onChange={(e) => setInvoiceData((d) => ({ ...d, vatId: e.target.value }))}
                    />
                  </div>
                </>
              )}
              <input
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t("guestCall.placeholder.street")}
                value={invoiceData.street}
                onChange={(e) => setInvoiceData((d) => ({ ...d, street: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t("guestCall.placeholder.houseNumber")}
                value={invoiceData.houseNumber}
                onChange={(e) => setInvoiceData((d) => ({ ...d, houseNumber: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t("guestCall.placeholder.zip")}
                value={invoiceData.zip}
                onChange={(e) => setInvoiceData((d) => ({ ...d, zip: e.target.value }))}
              />
              <input
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t("guestCall.placeholder.city")}
                value={invoiceData.city}
                onChange={(e) => setInvoiceData((d) => ({ ...d, city: e.target.value }))}
              />
              <div className="col-span-2">
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t("guestCall.placeholder.country")}
                  value={invoiceData.country}
                  onChange={(e) => setInvoiceData((d) => ({ ...d, country: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <input
                  type="email"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t("guestCall.placeholder.emailInvoice")}
                  value={invoiceData.email}
                  onChange={(e) => setInvoiceData((d) => ({ ...d, email: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Optional onboarding */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
          <h3 className="font-semibold text-slate-800">{t("guestCall.onboarding")}</h3>
          <p className="text-sm text-slate-500">{t("guestCall.onboardingDesc")}</p>
          <input
            type="password"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={t("guestCall.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {/* Legal consents */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="consentWithdrawal"
              checked={consentWithdrawal}
              onChange={(e) => setConsentWithdrawal(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 accent-primary flex-shrink-0"
            />
            <label htmlFor="consentWithdrawal" className="text-sm text-slate-600 leading-snug cursor-pointer">
              {t("guestCall.consentWithdrawal")}
            </label>
          </div>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="consentSnapshot"
              checked={consentSnapshot}
              onChange={(e) => setConsentSnapshot(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 accent-primary flex-shrink-0"
            />
            <label htmlFor="consentSnapshot" className="text-sm text-slate-600 leading-snug cursor-pointer">
              <ShieldCheck className="inline h-4 w-4 text-primary mr-1" />
              {t("guestCall.consentSnapshot")}
            </label>
          </div>
        </div>

        {/* Errors */}
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-primary text-white py-4 rounded-2xl font-semibold text-base hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {t("guestCall.proceedToPayment")}
        </button>
      </div>
    </div>
  )
}

// ── Guest Video Call Component ────────────────────────────────────────────────

// Blitzlicht-Protokoll: Snapshot-Zeitpunkte in Sekunden nach Call-Beitritt
const SNAPSHOT_TIMES_SEC = [5, 30, 60, 90, 120]

function GuestVideoCall({
  roomUrl,
  token,
  guestName,
  guestToken,
  onLeave,
  dailyCallRef,
}: {
  roomUrl: string
  token: string
  guestName: string
  guestToken: string
  onLeave: () => void
  dailyCallRef: React.MutableRefObject<unknown>
}) {
  const { t } = useI18n()
  const [phase, setPhase] = useState<"joining" | "in_call" | "error">("joining")
  const [errorMsg, setErrorMsg] = useState("")
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const snapshotTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Capture a frame from the local video as base64 JPEG
  const captureLocalFrame = useCallback((): string | null => {
    const video = localVideoRef.current
    if (!video || video.readyState < 2) return null
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 320
      canvas.height = 240
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL("image/jpeg", 0.7)
    } catch {
      return null
    }
  }, [])

  // Send a single snapshot to the guest safety endpoint
  const sendSnapshot = useCallback(async () => {
    const imageBase64 = captureLocalFrame()
    if (!imageBase64) return
    try {
      const res = await fetch("/api/guest/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestToken, imageBase64 }),
      })
      const data = await res.json().catch(() => null)
      if (data?.incidentCreated) {
        console.warn("[GuestVideoCall] Safety violation – ending call.")
        onLeave()
      }
    } catch {
      // Non-blocking: snapshot failure must not interrupt the call
    }
  }, [captureLocalFrame, guestToken, onLeave])

  // Schedule Blitzlicht snapshots after joining
  const scheduleSnapshots = useCallback(() => {
    // Clear any previous timers
    snapshotTimersRef.current.forEach(clearTimeout)
    snapshotTimersRef.current = SNAPSHOT_TIMES_SEC.map((sec) =>
      setTimeout(() => sendSnapshot(), sec * 1000)
    )
  }, [sendSnapshot])

  useEffect(() => {
    let call: DailyCall | null = null

    async function joinCall() {
      try {
        const Daily = (await import("@daily-co/daily-js")).default
        call = Daily.createCallObject({ subscribeToTracksAutomatically: true })
        dailyCallRef.current = call

        call.on("track-started", (ev) => {
          if (!ev?.participant?.local && ev?.track?.kind === "video" && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream([ev.track])
          }
          if (ev?.participant?.local && ev?.track?.kind === "video" && localVideoRef.current) {
            localVideoRef.current.srcObject = new MediaStream([ev.track])
          }
        })

        call.on("left-meeting", () => {
          setPhase("in_call")
          onLeave()
        })

        call.on("error", (ev) => {
          console.error("[GuestVideoCall] Daily error:", ev)
          setErrorMsg(t("guestCall.videoConnectionError"))
          setPhase("error")
        })

        await call.join({ url: roomUrl, token, userName: guestName })
        setPhase("in_call")
        scheduleSnapshots()
      } catch (err) {
        console.error("[GuestVideoCall] join failed:", err)
        setErrorMsg(t("guestCall.videoRoomJoinFailed"))
        setPhase("error")
      }
    }

    joinCall()

    return () => {
      snapshotTimersRef.current.forEach(clearTimeout)
      if (call) {
        call.leave().catch(() => {})
        call.destroy()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token])

  const handleLeave = useCallback(async () => {
    const call = dailyCallRef.current as DailyCall | null
    if (call) {
      await call.leave().catch(() => {})
      call.destroy()
      dailyCallRef.current = null
    }
    onLeave()
  }, [dailyCallRef, onLeave])

  const toggleMic = useCallback(async () => {
    const call = dailyCallRef.current as DailyCall | null
    if (!call) return
    const next = !micOn
    await call.setLocalAudio(next)
    setMicOn(next)
  }, [micOn, dailyCallRef])

  const toggleCam = useCallback(async () => {
    const call = dailyCallRef.current as DailyCall | null
    if (!call) return
    const next = !camOn
    await call.setLocalVideo(next)
    setCamOn(next)
  }, [camOn, dailyCallRef])

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-700 mb-4">{errorMsg}</p>
          <button onClick={onLeave} className="bg-primary text-white px-6 py-2 rounded-xl">
            {t("guestCall.back")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Remote video (full screen) */}
      <div className="flex-1 relative">
        {phase === "joining" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3" />
              <p className="text-sm opacity-75">{t("guestCall.connecting")}</p>
            </div>
          </div>
        )}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {/* Local video (PiP) */}
        <div className="absolute bottom-24 right-4 w-28 h-20 rounded-xl overflow-hidden border-2 border-white/30 bg-slate-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-sm py-6 px-8 flex items-center justify-center gap-6">
        <button
          onClick={toggleMic}
          className={`rounded-full p-4 transition ${micOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}
        >
          {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>
        <button
          onClick={handleLeave}
          className="rounded-full p-4 bg-red-600 text-white hover:bg-red-700 transition"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
        <button
          onClick={toggleCam}
          className={`rounded-full p-4 transition ${camOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}
        >
          {camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </button>
      </div>
    </div>
  )
}

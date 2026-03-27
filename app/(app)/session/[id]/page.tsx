"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DailyCallContainer } from "@/components/video-call/DailyCallContainer"
import { ConnectingSplash } from "@/components/connecting-splash"
import { ReviewStars } from "@/components/review-stars"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"
import { parseBerlinDateTime } from "@/lib/date-utils"
import { toast } from "sonner"

type CallMode = "video" | "voice"
type UserRole = "shugyo" | "takumi"

interface BookingData {
  booking: {
    id: string
    expertId: string
    date: string
    startTime: string
    endTime: string
    callType: "VIDEO" | "VOICE"
    bookingMode?: "scheduled" | "instant"
    isExpert: boolean
    isGuestCall?: boolean
    guestToken?: string | null
    userName: string
    takumiName: string
    takumiImageUrl: string
    userImageUrl: string
    status: string
    paymentStatus?: string
    paidAmount?: number | null
    safetyAcceptedAt?: string | null
    sessionStartedAt?: string | null
    userBalanceCents?: number
    pricePerMinuteCents?: number
    hasPaidBefore?: boolean
  }
}

function PostCallScreen({
  bookingId,
  expertId,
  isExpert,
  partnerName,
  paymentStatus,
  paidAmountCents,
  bookingMode,
  onDone,
}: {
  bookingId: string
  expertId: string
  isExpert: boolean
  partnerName: string
  paymentStatus?: string
  paidAmountCents?: number | null
  bookingMode?: "scheduled" | "instant"
  onDone: () => void
}) {
  const { t } = useI18n()
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showReleaseDialog, setShowReleaseDialog] = useState(false)
  const submitReviewInFlightRef = useRef(false)

  const formatAmount = (cents: number) =>
    `€${(cents / 100).toFixed(2).replace(".", ",")}`

  const submitReviewOnly = useCallback(async () => {
    if (submitReviewInFlightRef.current) return
    submitReviewInFlightRef.current = true
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isExpert ? "submit-expert-rating" : "submit-review",
          rating,
          reviewText,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? t("toast.saveError"))
      toast.success(t("toast.ratingSaved"))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"))
    } finally {
      submitReviewInFlightRef.current = false
      setSubmitting(false)
    }
  }, [bookingId, isExpert, rating, reviewText, onDone, t])

  const handleSubmitReview = useCallback(() => {
    if (submitting || submitReviewInFlightRef.current) return
    if (rating < 1) return
    if (!isExpert && paymentStatus === "paid" && (paidAmountCents ?? 0) > 0) {
      setShowReleaseDialog(true)
    } else {
      submitReviewOnly()
    }
  }, [rating, isExpert, paymentStatus, paidAmountCents, submitReviewOnly, submitting])

  const handleReleaseAndSubmit = useCallback(async () => {
    if (submitReviewInFlightRef.current) return
    submitReviewInFlightRef.current = true
    setShowReleaseDialog(false)
    setSubmitting(true)
    try {
      const [releaseRes, reviewRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "release-payment" }),
        }),
        fetch(`/api/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit-review",
            rating,
            reviewText,
          }),
        }),
      ])
      if (!releaseRes.ok) throw new Error((await releaseRes.json())?.error ?? t("toast.releaseFailed"))
      if (!reviewRes.ok) throw new Error((await reviewRes.json())?.error ?? t("toast.saveError"))
      toast.success(t("toast.releaseAndRating"))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"))
    } finally {
      submitReviewInFlightRef.current = false
      setSubmitting(false)
    }
  }, [bookingId, rating, reviewText, onDone, t])

  const handleReportAndSubmit = useCallback(async () => {
    if (submitReviewInFlightRef.current) return
    setShowReleaseDialog(false)
    setSubmitting(true)
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report-problem" }),
      })
      await submitReviewOnly()
      toast.info(t("toast.callReportedReview"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"))
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, submitReviewOnly, t])

  const handleReportOnly = useCallback(async () => {
    setSubmitting(true)
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report-problem" }),
      })
      toast.info(t("toast.callReported"))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"))
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, onDone, t])

  const handleReleasePayment = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release-payment" }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? t("toast.releaseFailed"))
      toast.success(t("toast.releaseSuccess"))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"))
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, onDone, t])

  const handleInstantConfirmAndRelease = useCallback(async () => {
    setShowReleaseDialog(false)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release-payment" }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? t("toast.releaseFailed"))
      toast.success(t("toast.releaseConfirmed"))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"))
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, onDone, t])

  const canReleasePayment = !isExpert && paymentStatus === "paid"
  const isInstantShugyo = !isExpert && bookingMode === "instant"
  const incurredAmount = paidAmountCents ?? 0

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-8">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">{t("session.ended")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("session.ratePartner", { name: partnerName })}
        </p>
      </div>

      {/* Instant: Entstandene Gebühren anzeigen (auch bei 0 €) */}
      {isInstantShugyo && (
        <div className="w-full max-w-sm rounded-xl border-2 border-primary/30 bg-primary/5 p-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">{t("session.incurredFees")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {(incurredAmount / 100).toFixed(2).replace(".", ",")} €
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {incurredAmount > 0
              ? t("session.confirmOrReport")
              : t("session.noFeesUnder30s")}
          </p>
        </div>
      )}

      <ReviewStars rating={rating} size="lg" interactive onRate={setRating} />

      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        placeholder={t("session.reviewPlaceholder")}
        className="w-full max-w-sm resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        rows={3}
      />

      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("session.releaseDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("session.releaseDialogDescAmount", { amount: formatAmount(paidAmountCents ?? 0) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleReleaseAndSubmit}
              disabled={submitting}
              className="w-full"
            >
              {t("session.releaseAmount")}
            </Button>
            <Button
              onClick={handleReportAndSubmit}
              disabled={submitting}
              variant="destructive"
              className="w-full"
            >
              {t("session.reportCall")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {/* Instant: Freigeben/Melden zuerst, dann Bewertung */}
        {isInstantShugyo && (
          <>
            {incurredAmount > 0 && (
              <Button
                onClick={handleInstantConfirmAndRelease}
                disabled={submitting}
                className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t("session.confirmAndRelease")}
              </Button>
            )}
            <Button
              onClick={handleReportOnly}
              disabled={submitting}
              variant={incurredAmount > 0 ? "destructive" : "outline"}
              className="h-12 w-full rounded-xl"
            >
              {t("session.reportCall")}
            </Button>
          </>
        )}
        <Button
          onClick={handleSubmitReview}
          disabled={rating === 0 || submitting}
          className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {t("session.submitReview")}
        </Button>
        {canReleasePayment && !isInstantShugyo && (
          <Button
            onClick={handleReleasePayment}
            disabled={submitting}
            variant="outline"
            className="h-12 w-full rounded-xl border-accent text-accent hover:bg-accent/10"
          >
            {t("session.releaseAndSkip")}
          </Button>
        )}
        {!canReleasePayment && (
          <Button asChild variant="outline" className="h-12 w-full rounded-xl">
            <Link href={`/takumi/${expertId}`}>{t("session.backToProfile")}</Link>
          </Button>
        )}
        <Button
          onClick={onDone}
          variant="ghost"
          disabled={submitting}
          className="h-12 w-full rounded-xl"
        >
          {t("session.toOverview")}
        </Button>
      </div>
    </div>
  )
}

function SessionCallContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const bookingId = params.id as string
  const isWaitMode = searchParams.get("wait") === "true"
  const isConnecting = searchParams.get("connecting") === "1"

  const [data, setData] = useState<BookingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"call" | "post-call">("call")
  const [hasJoinedCall, setHasJoinedCall] = useState(false)
  // Guest call: Takumi waits for payment
  const [guestPaymentPaid, setGuestPaymentPaid] = useState(false)

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`)
      if (!res.ok) {
        const err = (await res.json()).error ?? t("session.bookingNotFound")
        setError(err)
        return
      }
      const json = await res.json()
      setData(json)
      // If this is a guest call and payment is already done, skip waiting
      if (json?.booking?.isGuestCall && json?.booking?.paymentStatus === "paid") {
        setGuestPaymentPaid(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("toast.loadError"))
    }
  }, [bookingId, t])

  useEffect(() => {
    fetchBooking()
  }, [fetchBooking])

  // Poll für Takumi im Gast-Call-Warteraum: bis Gast bezahlt hat
  const shouldPollGuestPayment =
    data?.booking?.isGuestCall && data?.booking?.isExpert && !guestPaymentPaid
  useEffect(() => {
    if (!shouldPollGuestPayment) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`)
        if (!res.ok) return
        const json = await res.json()
        if (json?.booking?.paymentStatus === "paid") {
          setData(json)
          setGuestPaymentPaid(true)
        }
      } catch { /* ignore */ }
    }, 2500)
    return () => clearInterval(timer)
  }, [shouldPollGuestPayment, bookingId])

  // Poll für Shugyo im Wartemodus (Instant-Anklopf): bis Takumi annimmt oder ablehnt
  const shouldPollWait = isWaitMode && data && !data.booking.isExpert && data.booking.status === "pending"
  useEffect(() => {
    if (!shouldPollWait) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`)
        if (!res.ok) return
        const json = await res.json()
        if (json?.booking?.status !== "pending") {
          setData(json)
        }
      } catch {
        /* ignore */
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [shouldPollWait, bookingId])

  const goToSessions = useCallback(() => {
    router.push("/sessions")
  }, [router])

  const handleBackFromCall = useCallback(async () => {
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end-session" }),
      })
    } catch {
      /* ignore – e.g. not yet in active call */
    }
    router.push("/sessions")
  }, [bookingId, router])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push("/sessions")}>
          {t("sessions.backToSessions")}
        </Button>
      </div>
    )
  }

  if (!data) {
    return isConnecting ? <ConnectingSplash /> : <SessionSkeleton />
  }

  const { booking } = data
  const callMode: CallMode = booking.callType === "VIDEO" ? "video" : "voice"
  const userRole: UserRole = booking.isExpert ? "takumi" : "shugyo"
  const partnerName = booking.isExpert ? booking.userName : booking.takumiName
  const partnerImageUrl = booking.isExpert ? booking.userImageUrl : booking.takumiImageUrl

  // ── Takumi wartet auf Gast-Zahlung ──────────────────────────────────────────
  if (booking.isGuestCall && booking.isExpert && !guestPaymentPaid) {
    const guestCallLink = booking.guestToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/call/${booking.guestToken}`
      : null
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-amber-100 animate-pulse">
          <span className="text-4xl">💳</span>
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-foreground">Warte auf Gast-Zahlung</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dein Gast muss zuerst bezahlen, bevor der Call startet. Diese Seite aktualisiert sich automatisch.
          </p>
          {guestCallLink && (
            <div className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground break-all">
              <p className="font-medium mb-1">Einladungslink für den Gast:</p>
              <span className="select-all">{guestCallLink}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Warte auf Zahlung…
        </div>
        <Button variant="outline" onClick={() => router.push("/sessions")}>
          {t("sessions.backToSessions")}
        </Button>
      </div>
    )
  }

  // Shugyo wartet auf Takumi (Instant-Anklopf)
  if (isWaitMode && !booking.isExpert && booking.status === "pending") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 animate-pulse">
          <span className="text-4xl">📞</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Anklopfen…</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("session.waitingForTakumi", { name: booking.takumiName })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/home")}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    )
  }

  // Instant-Anfrage abgelaufen (60s ohne Antwort)
  if (isWaitMode && !booking.isExpert && booking.status === "instant_expired") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="flex size-20 items-center justify-center rounded-full bg-muted">
          <span className="text-4xl">⏱️</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{t("session.noExpertAvailableTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("session.noExpertAvailableDesc")}
          </p>
        </div>
        <Button onClick={() => router.push("/home")}>{t("session.tryAgainLater")}</Button>
      </div>
    )
  }

  // Takumi hat abgelehnt
  if (isWaitMode && !booking.isExpert && ["declined", "cancelled"].includes(booking.status)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{t("session.requestDeclinedTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("session.requestDeclinedDesc", { name: booking.takumiName })}
          </p>
        </div>
        <Button onClick={() => router.push("/home")}>{t("common.startPage")}</Button>
      </div>
    )
  }

  const scheduledEndedAt = parseBerlinDateTime(
    booking.date,
    booking.endTime || booking.startTime || "00:00"
  )
  const isExpiredScheduled = ["pending", "confirmed"].includes(booking.status) && scheduledEndedAt <= new Date()
  if (isExpiredScheduled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-muted-foreground">
          {t("session.expiredBookingFallback")}
        </p>
        <Button variant="outline" onClick={() => router.push("/sessions")}>
          {t("sessions.backToSessions")}
        </Button>
      </div>
    )
  }

  const showConnecting =
    isConnecting &&
    booking.status === "confirmed" &&
    viewMode === "call" &&
    !hasJoinedCall

  if (viewMode === "post-call") {
    return (
      <PostCallScreen
        bookingId={booking.id}
        expertId={booking.expertId}
        isExpert={booking.isExpert}
        partnerName={partnerName}
        paymentStatus={booking.paymentStatus}
        paidAmountCents={booking.paidAmount}
        bookingMode={booking.bookingMode}
        onDone={goToSessions}
      />
    )
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden md:min-h-[80vh]">
      {showConnecting && <ConnectingSplash />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <DailyCallContainer
          bookingId={booking.id}
          callMode={callMode}
          userRole={userRole}
          partnerImageUrl={partnerImageUrl || undefined}
          partnerName={partnerName}
          safetyAcceptedAt={booking.safetyAcceptedAt}
          onSessionStarted={() => setHasJoinedCall(true)}
          onCallEnded={() => {
            setViewMode("post-call")
            fetchBooking()
          }}
          bookingMode={booking.bookingMode}
          scheduledDate={booking.date}
          scheduledStartTime={booking.startTime}
          bookingStatus={booking.status}
          sessionStartedAt={booking.sessionStartedAt}
          userBalanceCents={booking.userBalanceCents}
          pricePerMinuteCents={booking.pricePerMinuteCents}
          hasPaidBefore={booking.hasPaidBefore}
        />
      </div>
      <div className="shrink-0 border-t px-4 py-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleBackFromCall}
        >
          {t("sessions.backToSessions")}
        </Button>
      </div>
    </div>
  )
}

function SessionSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col gap-4 overflow-hidden p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="aspect-video w-full flex-1 rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  )
}

export default function SessionCallPage() {
  return (
    <div className="h-dvh overflow-hidden md:min-h-screen">
      <Suspense fallback={<SessionSkeleton />}>
        <SessionCallContent />
      </Suspense>
    </div>
  )
}

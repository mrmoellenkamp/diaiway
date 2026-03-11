"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DailyCallContainer } from "@/components/video-call/DailyCallContainer"
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
import { toast } from "sonner"

type CallMode = "video" | "voice"
type UserRole = "shugyo" | "takumi"

interface BookingData {
  booking: {
    id: string
    expertId: string
    callType: "VIDEO" | "VOICE"
    bookingMode?: "scheduled" | "instant"
    isExpert: boolean
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
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showReleaseDialog, setShowReleaseDialog] = useState(false)

  const formatAmount = (cents: number) =>
    `€${(cents / 100).toFixed(2).replace(".", ",")}`

  const submitReviewOnly = useCallback(async () => {
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
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      toast.success("Bewertung gespeichert! Danke.")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, isExpert, rating, reviewText, onDone])

  const handleSubmitReview = useCallback(() => {
    if (rating < 1) return
    if (!isExpert && paymentStatus === "paid" && (paidAmountCents ?? 0) > 0) {
      setShowReleaseDialog(true)
    } else {
      submitReviewOnly()
    }
  }, [rating, isExpert, paymentStatus, paidAmountCents, submitReviewOnly])

  const handleReleaseAndSubmit = useCallback(async () => {
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
      if (!releaseRes.ok) throw new Error((await releaseRes.json())?.error ?? "Freigabe fehlgeschlagen")
      if (!reviewRes.ok) throw new Error((await reviewRes.json())?.error ?? "Bewertung fehlgeschlagen")
      toast.success("Betrag freigegeben und Bewertung gespeichert! Danke.")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, rating, reviewText, onDone])

  const handleReportAndSubmit = useCallback(async () => {
    setShowReleaseDialog(false)
    setSubmitting(true)
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report-problem" }),
      })
      await submitReviewOnly()
      toast.info("Call wurde gemeldet. Deine Bewertung wurde gespeichert.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, submitReviewOnly])

  const handleReportOnly = useCallback(async () => {
    setSubmitting(true)
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report-problem" }),
      })
      toast.info("Call wurde gemeldet. Wir prüfen den Vorgang.")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, onDone])

  const handleReleasePayment = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release-payment" }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Freigabe fehlgeschlagen")
      toast.success("Geld freigegeben!")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, onDone])

  const handleInstantConfirmAndRelease = useCallback(async () => {
    setShowReleaseDialog(false)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release-payment" }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? "Freigabe fehlgeschlagen")
      toast.success("Abrechnung bestätigt und freigegeben!")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSubmitting(false)
    }
  }, [bookingId, onDone])

  const canReleasePayment = !isExpert && paymentStatus === "paid"
  const isInstantShugyo = !isExpert && bookingMode === "instant"
  const incurredAmount = paidAmountCents ?? 0

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-8">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Session beendet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bewerte {partnerName} – ihr habt euch gegenseitig unterstützt.
        </p>
      </div>

      {/* Instant: Entstandene Gebühren prominent anzeigen */}
      {isInstantShugyo && incurredAmount > 0 && (
        <div className="w-full max-w-sm rounded-xl border-2 border-primary/30 bg-primary/5 p-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">Entstandene Gebühren</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {(incurredAmount / 100).toFixed(2).replace(".", ",")} €
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Bitte bestätige die Abrechnung oder melde den Call.
          </p>
        </div>
      )}

      <ReviewStars rating={rating} size="lg" interactive onRate={setRating} />

      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        placeholder="Optional: Schreibe eine Bewertung..."
        className="w-full max-w-sm resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        rows={3}
      />

      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Betrag freigeben oder Call melden?</DialogTitle>
            <DialogDescription>
              Soll der Betrag von {formatAmount(paidAmountCents ?? 0)} sofort freigegeben werden,
              oder möchtest du den Call melden?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={handleReleaseAndSubmit}
              disabled={submitting}
              className="w-full"
            >
              Betrag freigeben
            </Button>
            <Button
              onClick={handleReportAndSubmit}
              disabled={submitting}
              variant="destructive"
              className="w-full"
            >
              Call melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {/* Instant: Freigeben/Melden zuerst, dann Bewertung */}
        {isInstantShugyo && incurredAmount > 0 && (
          <>
            <Button
              onClick={handleInstantConfirmAndRelease}
              disabled={submitting}
              className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Abrechnung bestätigen & freigeben
            </Button>
            <Button
              onClick={handleReportOnly}
              disabled={submitting}
              variant="destructive"
              className="h-12 w-full rounded-xl"
            >
              Call melden
            </Button>
          </>
        )}
        <Button
          onClick={handleSubmitReview}
          disabled={rating === 0 || submitting}
          className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Bewertung abgeben
        </Button>
        {canReleasePayment && !isInstantShugyo && (
          <Button
            onClick={handleReleasePayment}
            disabled={submitting}
            variant="outline"
            className="h-12 w-full rounded-xl border-accent text-accent hover:bg-accent/10"
          >
            Geld freigeben & überspringen
          </Button>
        )}
        {!canReleasePayment && (
          <Button asChild variant="outline" className="h-12 w-full rounded-xl">
            <Link href={`/takumi/${expertId}`}>Zurück zum Profil</Link>
          </Button>
        )}
        <Button
          onClick={onDone}
          variant="ghost"
          disabled={submitting}
          className="h-12 w-full rounded-xl"
        >
          Zur Übersicht
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

  const [data, setData] = useState<BookingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"call" | "post-call">("call")

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`)
      if (!res.ok) {
        const err = (await res.json()).error ?? "Buchung nicht gefunden"
        setError(err)
        return
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden")
    }
  }, [bookingId])

  useEffect(() => {
    fetchBooking()
  }, [fetchBooking])

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

  if (!data) return <SessionSkeleton />

  const { booking } = data
  const callMode: CallMode = booking.callType === "VIDEO" ? "video" : "voice"
  const userRole: UserRole = booking.isExpert ? "takumi" : "shugyo"
  const partnerName = booking.isExpert ? booking.userName : booking.takumiName
  const partnerImageUrl = booking.isExpert ? booking.userImageUrl : booking.takumiImageUrl

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
            Warte auf Antwort von {booking.takumiName}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/home")}>
            Abbrechen
          </Button>
        </div>
      </div>
    )
  }

  // Takumi hat abgelehnt
  if (isWaitMode && !booking.isExpert && ["declined", "cancelled"].includes(booking.status)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Anfrage abgelehnt</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {booking.takumiName} ist gerade nicht verfügbar.
          </p>
        </div>
        <Button onClick={() => router.push("/home")}>Zurück zur Startseite</Button>
      </div>
    )
  }

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
    <div className="flex h-dvh flex-col overflow-hidden md:min-h-[80vh]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <DailyCallContainer
          bookingId={booking.id}
          callMode={callMode}
          userRole={userRole}
          partnerImageUrl={partnerImageUrl || undefined}
          partnerName={partnerName}
          safetyAcceptedAt={booking.safetyAcceptedAt}
          onCallEnded={() => {
            setViewMode("post-call")
            fetchBooking()
          }}
          bookingMode={booking.bookingMode}
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

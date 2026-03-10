"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { DailyCallContainer } from "@/components/video-call/DailyCallContainer"
import { ReviewStars } from "@/components/review-stars"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  onDone,
}: {
  bookingId: string
  expertId: string
  isExpert: boolean
  partnerName: string
  paymentStatus?: string
  onDone: () => void
}) {
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmitReview = useCallback(async () => {
    if (rating < 1) return
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

  const canReleasePayment = !isExpert && paymentStatus === "paid"

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-8">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">Session beendet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bewerte {partnerName} – ihr habt euch gegenseitig unterstützt.
        </p>
      </div>

      <ReviewStars rating={rating} size="lg" interactive onRate={setRating} />

      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        placeholder="Optional: Schreibe eine Bewertung..."
        className="w-full max-w-sm resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        rows={3}
      />

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button
          onClick={handleSubmitReview}
          disabled={rating === 0 || submitting}
          className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Bewertung abgeben
        </Button>
        {canReleasePayment && (
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

  useEffect(() => {
    let cancelled = false
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`)
        if (!res.ok) {
          const err = (await res.json()).error ?? "Buchung nicht gefunden"
          if (!cancelled) setError(err)
          return
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Fehler beim Laden")
      }
    }
    fetchBooking()
    return () => {
      cancelled = true
    }
  }, [bookingId])

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
          onCallEnded={() => setViewMode("post-call")}
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

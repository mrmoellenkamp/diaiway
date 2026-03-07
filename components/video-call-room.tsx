"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { HandshakeOverlay } from "@/components/handshake-overlay"
import { toast } from "sonner"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  AlertTriangle,
  User,
  ArrowLeft,
  Clock,
  Shield,
  Star,
  Loader2,
} from "lucide-react"
import { DailyVideoCall } from "@/components/VideoConfig"
import type { BookingRecord } from "@/lib/types"
import { useI18n } from "@/lib/i18n"
import { parseBerlinDateTime } from "@/lib/date-utils"

type Phase = "loading" | "pre-call" | "trial" | "handshake" | "paid" | "rating" | "error"

interface VideoCallRoomProps {
  bookingId: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const FALLBACK_DAILY_DOMAIN = "https://diaiway.daily.co"

export function VideoCallRoom({ bookingId }: VideoCallRoomProps) {
  const router = useRouter()
  const { t } = useI18n()
  const dailyDomain =
    (typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_DAILY_DOMAIN as string | undefined)
      : process.env.NEXT_PUBLIC_DAILY_DOMAIN) || FALLBACK_DAILY_DOMAIN
  const fallbackRoomUrl = `${dailyDomain.replace(/\/$/, "")}/${bookingId}`
  const [booking, setBooking] = useState<BookingRecord | null>(null)
  const [roomUrl, setRoomUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("loading")
  const [timer, setTimer] = useState(300)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [isInCall, setIsInCall] = useState(false)

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }, [])

  // Load booking
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`)
        const data = await res.json()
        if (!res.ok) {
          setErrorMsg(data.error || t("video.loadError"))
          setPhase("error")
          return
        }
        setBooking(data.booking)
        if (data.booking.status === "active") {
          setPhase("paid")
          setTimer(1800)
          setIsInCall(true)
        } else if (data.booking.status === "confirmed") {
          setPhase("pre-call")
        } else if (data.booking.status === "completed") {
          setPhase("rating")
        } else {
          setErrorMsg(t("video.bookingStatusError", { status: data.booking.status }))
          setPhase("error")
        }
      } catch {
        setErrorMsg(t("common.networkError"))
        setPhase("error")
      }
    }
    load()
  }, [bookingId])

  // Trial / paid countdown
  useEffect(() => {
    if (phase !== "trial" && phase !== "paid") return
    if (timer <= 0) {
      if (phase === "trial") setPhase("handshake")
      return
    }
    const interval = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(interval)
  }, [phase, timer])

  async function patchBooking(action: string, extra?: { rating?: number; reviewText?: string }) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("video.error"))
        return null
      }
      return data
    } catch {
      toast.error(t("common.networkError"))
      return null
    }
  }

  // Fetch room URL when we need to join (pre-call or already in call)
  const fetchRoomUrl = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/daily/room?bookingId=${encodeURIComponent(bookingId)}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("video.loadError"))
        return null
      }
      return data.roomUrl ?? null
    } catch {
      toast.error(t("common.networkError"))
      return null
    }
  }, [bookingId, t])

  useEffect(() => {
    if (!isInCall || roomUrl || !booking) return
    if (booking.status !== "confirmed" && booking.status !== "active") return
    let cancelled = false
    fetchRoomUrl().then((url) => {
      if (!cancelled && url) setRoomUrl(url)
    })
    return () => { cancelled = true }
  }, [isInCall, roomUrl, booking, fetchRoomUrl])

  const handleStartTrial = async () => {
    const url = await fetchRoomUrl()
    if (!url) return
    const result = await patchBooking("start-session")
    if (result) {
      setRoomUrl(url)
      setPhase("trial")
      setTimer(300)
      setIsInCall(true)
      toast.success(t("video.sessionStarted"))
    }
  }

  // Check how many minutes until the session starts (Berlin time, for early-join blocking)
  const minutesUntilStart = booking
    ? Math.ceil(
        (parseBerlinDateTime(booking.date, booking.startTime).getTime() - Date.now()) / 60000
      )
    : 999
  const tooEarlyToJoin = minutesUntilStart > 5

  const handlePaymentSuccess = () => {
    setPhase("paid")
    setTimer(1800)
    toast.success(t("video.paymentSuccess"))
  }

  const handleEndCall = async () => {
    const result = await patchBooking("end-session")
    setIsInCall(false)
    setPhase("rating")
    if (result?.isFreeSession) {
      if (result?.autoRefunded) {
        toast.success(t("video.refundInfo"))
      } else {
        toast.info(t("video.trialEndedShort"))
      }
    } else {
      toast.info(t("video.sessionEnded"))
    }
  }

  const handleSubmitRating = async () => {
    const action = booking?.isExpert ? "submit-expert-rating" : "submit-review"
    const result = await patchBooking(action, { rating, reviewText })
    if (result) {
      toast.success(t("video.ratingSaved"))
      router.push("/sessions")
    }
  }

  const handleSkipRating = () => {
    router.push("/sessions")
  }

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (!booking) {
    if (phase === "error") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
          <AlertTriangle className="size-12 text-destructive" />
          <p className="text-center text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={() => router.push("/sessions")}>
            {t("video.backToSessions")}
          </Button>
        </div>
      )
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const initials = getInitials(booking.takumiName)

  // ─── Pre-call ─────────────────────────────────────────────────────────────

  if (phase === "pre-call") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-6 px-4 py-8">
          <div className="flex w-full items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">{t("video.startSession")}</h1>
          </div>

          <Avatar className="size-24 border-4 border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-xl font-bold text-foreground">{booking.takumiName}</h2>
            {booking.takumiSubcategory && (
              <p className="text-sm text-muted-foreground">{booking.takumiSubcategory}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {booking.date} | {booking.startTime} – {booking.endTime}
            </p>
          </div>

          <Card className="w-full gap-0 border-border/60 py-0">
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">{t("video.fiveMinFree")}</p>
                  <p className="text-xs text-muted-foreground">{t("video.learnTakumi")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="size-4 text-accent" />
                <div>
                  <p className="font-medium text-foreground">{t("video.escrowProtection")}</p>
                  <p className="text-xs text-muted-foreground">{t("video.paymentAfterRelease")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Star className="size-4 text-amber" />
                <div>
                  <p className="font-medium text-foreground">{t("video.thenPrice", { price: booking.price })}</p>
                  <p className="text-xs text-muted-foreground">{t("video.decideAfterTrial")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mic / Camera toggles */}
          <div className="flex gap-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`flex size-12 items-center justify-center rounded-full border transition-colors ${
                isMuted
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground"
              }`}
              aria-label={isMuted ? t("video.micOn") : t("video.micOff")}
            >
              {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
            <button
              onClick={() => setIsCameraOff(!isCameraOff)}
              className={`flex size-12 items-center justify-center rounded-full border transition-colors ${
                isCameraOff
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground"
              }`}
              aria-label={isCameraOff ? t("video.camOn") : t("video.camOff")}
            >
              {isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
            </button>
          </div>

          {tooEarlyToJoin && (
            <div className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock className="size-4 shrink-0" />
              <span>
                {t("video.roomOpens")}{" "}
                {minutesUntilStart > 60
                  ? t("video.roomOpensInHours", {
                      h: Math.floor(minutesUntilStart / 60),
                      m: minutesUntilStart % 60,
                    })
                  : t("video.roomOpensInMinutes", { n: minutesUntilStart })}
              </span>
            </div>
          )}

          <Button
            onClick={handleStartTrial}
            disabled={tooEarlyToJoin}
            className="h-14 w-full rounded-xl bg-accent text-lg font-bold text-accent-foreground shadow-lg hover:bg-accent/90 disabled:opacity-50"
          >
            <Video className="mr-2 size-5" />
            {t("video.join")}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {t("video.videoRoom")}{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{roomUrl || fallbackRoomUrl}</code>
          </p>
        </div>
      </div>
    )
  }

  // ─── Rating ──────────────────────────────────────────────────────────────

  if (phase === "rating") {
    const rateeName = booking.isExpert ? booking.userName : booking.takumiName
    const rateeInitials = getInitials(rateeName)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <Avatar className="size-20 border-4 border-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {rateeInitials}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{t("video.sessionEndedTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("video.howWasExperience", { name: rateeName })}
          </p>
          {booking.sessionDuration != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("video.duration", { min: booking.sessionDuration })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
              aria-label={t("video.starAria", { n: star })}
            >
              <Star
                className={`size-8 ${
                  star <= rating ? "fill-amber text-amber" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder={t("video.reviewPlaceholder")}
          className="w-full max-w-sm resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
        />

        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button
            onClick={handleSubmitRating}
            disabled={rating === 0}
            className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("video.submitRating")}
          </Button>
          <Button
            onClick={handleSkipRating}
            variant="outline"
            className="h-12 w-full rounded-xl"
          >
            {t("video.skip")}
          </Button>
        </div>
      </div>
    )
  }

  // ─── Error ───────────────────────────────────────────────────────────────

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <AlertTriangle className="size-12 text-destructive" />
        <p className="text-center text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={() => router.push("/sessions")}>
            {t("video.backToSessions")}
          </Button>
      </div>
    )
  }

  // ─── Active call (trial / paid) ───────────────────────────────────────────

  return (
    <>
      <div className="relative flex h-screen flex-col bg-foreground">
        {/* DailyVideoCall loaded client-only via dynamic import (ssr: false) */}
        {isInCall && roomUrl ? (
          <DailyVideoCall
            roomUrl={roomUrl}
            isCameraOff={isCameraOff}
            isMuted={isMuted}
            takumiName={booking.takumiName}
            initials={initials}
          />
        ) : isInCall ? (
          <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-10 animate-spin text-primary-foreground/60" />
              <p className="text-sm text-primary-foreground/80">Video-Raum wird vorbereitet...</p>
            </div>
          </div>
        ) : null}

        {/* Fallback while Daily is not yet in call */}
        {!isInCall && (
          <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-28 items-center justify-center rounded-full border-4 border-white/20 bg-white/10">
                <User className="size-12 text-primary-foreground/30" />
              </div>
              <p className="text-lg font-semibold text-primary-foreground">{booking.takumiName}</p>
              <Badge
                className={
                  phase === "trial"
                    ? "border-accent/50 bg-accent/20 text-accent"
                    : "border-amber/50 bg-amber/20 text-amber"
                }
              >
                {phase === "trial" ? t("video.freeTrial") : t("video.paidSession")}
              </Badge>
            </div>
          </div>
        )}

        {/* Timer overlay */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
            <span
              className={`size-2 rounded-full animate-live-pulse ${
                phase === "trial" ? "bg-accent" : "bg-amber"
              }`}
            />
            <span className="font-mono text-sm font-bold text-primary-foreground">
              {formatTime(timer)}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                phase === "trial"
                  ? "border-accent/50 text-accent"
                  : "border-amber/50 text-amber"
              }`}
            >
              {phase === "trial" ? t("video.trial") : t("video.paid")}
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pb-8 pt-12">
          <div className="mx-auto flex max-w-xs items-center justify-around">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`flex size-12 items-center justify-center rounded-full transition-colors ${
                isMuted ? "bg-destructive" : "bg-white/20"
              }`}
              aria-label={isMuted ? t("video.unmuteAria") : t("video.muteAria")}
            >
              {isMuted ? (
                <MicOff className="size-5 text-destructive-foreground" />
              ) : (
                <Mic className="size-5 text-primary-foreground" />
              )}
            </button>

            <button
              onClick={() => setIsCameraOff(!isCameraOff)}
              className={`flex size-12 items-center justify-center rounded-full transition-colors ${
                isCameraOff ? "bg-destructive" : "bg-white/20"
              }`}
              aria-label={isCameraOff ? t("video.camOn") : t("video.camOff")}
            >
              {isCameraOff ? (
                <VideoOff className="size-5 text-destructive-foreground" />
              ) : (
                <Video className="size-5 text-primary-foreground" />
              )}
            </button>

            <button
              onClick={handleEndCall}
              className="flex size-14 items-center justify-center rounded-full bg-destructive shadow-lg transition-transform active:scale-95"
              aria-label={t("video.endCall")}
            >
              <PhoneOff className="size-6 text-destructive-foreground" />
            </button>

            <button
              onClick={() => toast.info(t("video.reportSent"))}
              className="flex size-12 items-center justify-center rounded-full bg-white/20"
              aria-label={t("video.reportProblem")}
            >
              <AlertTriangle className="size-5 text-primary-foreground" />
            </button>
          </div>
        </div>
      </div>

      <HandshakeOverlay
        isOpen={phase === "handshake"}
        bookingId={bookingId}
        takumiName={booking.takumiName}
        onPaymentSuccess={handlePaymentSuccess}
        onEnd={handleEndCall}
        price={booking.price * 100}
        duration={30}
      />
    </>
  )
}

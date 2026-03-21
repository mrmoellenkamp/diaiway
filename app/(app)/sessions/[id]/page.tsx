"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ReviewStars } from "@/components/review-stars"
import { useTakumis } from "@/hooks/use-takumis"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import { takumiPublicLabel } from "@/lib/communication-display"
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
} from "lucide-react"

type Phase = "pre-call" | "trial" | "paid" | "rating"

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useI18n()
  const { takumis } = useTakumis()
  // Find the takumi by ID from URL param -- sessions are started from takumi profiles
  const takumiFromParams = takumis.find((t) => t.id === params.id)

  const [phase, setPhase] = useState<Phase>("pre-call")
  const [timer, setTimer] = useState(300) // 5 min in seconds
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState("")

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }, [])

  useEffect(() => {
    if (phase !== "trial" && phase !== "paid") return
    if (timer <= 0) {
      if (phase === "trial") {
        setPhase("rating")
      }
      return
    }
    const interval = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(interval)
  }, [phase, timer])

  if (!takumiFromParams) {
    return (
      <div className="flex min-h-screen items-center justify-center pb-safe">
        <p className="text-muted-foreground">Experte nicht gefunden.</p>
      </div>
    )
  }

  const takumi = takumiFromParams
  const takumiDisplay = takumiPublicLabel(takumi)

  const handleStartTrial = () => {
    setPhase("trial")
    setTimer(300)
  }

  const handleEndCall = () => {
    setPhase("rating")
    toast.info(t("toast.sessionEnded"))
  }

  const handleSubmitRating = () => {
    toast.success(t("toast.ratingSaved"))
    router.push("/sessions")
  }

  // Pre-call screen
  if (phase === "pre-call") {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-safe">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-6 px-4 py-8">
          <div className="flex w-full items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold">Session starten</h1>
          </div>
          <Avatar className="size-24 border-4 border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {takumi.avatar}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-xl font-bold text-foreground">{takumiDisplay}</h2>
            <p className="text-sm text-muted-foreground">{takumi.categoryName}</p>
            <div className="mt-1 flex items-center gap-1">
              <ReviewStars rating={takumi.rating} />
              <span className="text-xs text-muted-foreground">({takumi.reviewCount})</span>
            </div>
          </div>

          <Card className="w-full border-border/60 gap-0 py-0">
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">5 Minuten kostenlos testen</p>
                  <p className="text-xs text-muted-foreground">Lerne deinen Takumi kennen</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="size-4 text-accent" />
                <div>
                  <p className="font-medium text-foreground">Escrow-Schutz</p>
                  <p className="text-xs text-muted-foreground">Zahlung erst nach Freigabe</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Star className="size-4 text-amber-500" />
                <div>
                  <p className="font-medium text-foreground">Dann ab {(takumi.priceVoice15Min ?? (takumi.pricePerSession ? takumi.pricePerSession / 2 : 0)).toFixed(0)} € / 15 Min</p>
                  <p className="text-xs text-muted-foreground">Entscheide nach der Probezeit</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleStartTrial}
            className="h-14 w-full rounded-xl bg-accent text-lg font-bold text-accent-foreground shadow-lg hover:bg-accent/90"
          >
            <Video className="mr-2 size-5" />
            Starte 5-Min Probe
          </Button>
        </div>
      </div>
    )
  }

  // Rating screen
  if (phase === "rating") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 pb-safe">
        <Avatar className="size-20 border-4 border-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {takumi.avatar}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Session beendet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Wie war deine Erfahrung mit {takumiDisplay}?</p>
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
            onClick={handleSubmitRating}
            disabled={rating === 0}
            className="h-12 w-full rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            {t("session.submitReview")}
          </Button>
          <Button
            onClick={() => {
              toast.success(t("toast.releaseSuccess"))
              router.push("/sessions")
            }}
            variant="outline"
            className="h-12 w-full rounded-xl border-accent text-accent hover:bg-accent/10"
          >
            {t("session.releaseAndSkip")}
          </Button>
        </div>
      </div>
    )
  }

  // Video call screen (trial or paid)
  return (
    <>
      <div className="relative flex h-screen flex-col bg-foreground">
        {/* Remote video (full screen mock) */}
        <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-primary to-emerald-800">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="size-28 border-4 border-white/20">
              <AvatarFallback className="bg-white/10 text-white text-3xl font-bold">
                {takumi.avatar}
              </AvatarFallback>
            </Avatar>
            <p className="text-lg font-semibold text-white">{takumiDisplay}</p>
            <Badge
              className={
                phase === "trial"
                  ? "border-accent/50 bg-accent/20 text-accent"
                  : "border-amber-400/50 bg-amber-400/20 text-amber-200"
              }
            >
              {phase === "trial" ? "Kostenlose Probe" : "Bezahlte Session"}
            </Badge>
          </div>
        </div>

        {/* Self-view (small PIP) */}
        <div className="absolute right-4 top-16 flex size-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-stone-800 shadow-lg">
          {isCameraOff ? (
            <VideoOff className="size-8 text-white/40" />
          ) : (
            <User className="size-12 text-white/30" />
          )}
        </div>

        {/* Timer overlay */}
        <div className="absolute left-1/2 top-4 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
            <span className={`size-2 rounded-full ${phase === "trial" ? "bg-accent animate-live-pulse" : "bg-amber-400 animate-live-pulse"}`} />
            <span className="font-mono text-sm font-bold text-white">{formatTime(timer)}</span>
            <span className="text-[10px] text-white/60">
              {phase === "trial" ? "Probe" : "Bezahlt"}
            </span>
          </div>
        </div>

        {/* Controls bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pb-8 pt-12">
          <div className="mx-auto flex max-w-xs items-center justify-around">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`flex size-12 items-center justify-center rounded-full transition-colors ${isMuted ? "bg-destructive" : "bg-white/20"}`}
              aria-label={isMuted ? "Stummschaltung aufheben" : "Stummschalten"}
            >
              {isMuted ? <MicOff className="size-5 text-white" /> : <Mic className="size-5 text-white" />}
            </button>

            <button
              onClick={() => setIsCameraOff(!isCameraOff)}
              className={`flex size-12 items-center justify-center rounded-full transition-colors ${isCameraOff ? "bg-destructive" : "bg-white/20"}`}
              aria-label={isCameraOff ? "Kamera einschalten" : "Kamera ausschalten"}
            >
              {isCameraOff ? <VideoOff className="size-5 text-white" /> : <Video className="size-5 text-white" />}
            </button>

            <button
              onClick={handleEndCall}
              className="flex size-14 items-center justify-center rounded-full bg-destructive shadow-lg transition-transform active:scale-95"
              aria-label="Anruf beenden"
            >
              <PhoneOff className="size-6 text-white" />
            </button>

            <button
              onClick={() => toast.info(t("toast.messageSent"))}
              className="flex size-12 items-center justify-center rounded-full bg-white/20"
              aria-label="Problem melden"
            >
              <AlertTriangle className="size-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

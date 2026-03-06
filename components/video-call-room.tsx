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

export function VideoCallRoom({ bookingId }: VideoCallRoomProps) {
  const router = useRouter()
  const dailyRoomUrl = `https://diaiway.daily.co/${bookingId}`
  const [booking, setBooking] = useState<BookingRecord | null>(null)
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
          setErrorMsg(data.error || "Fehler beim Laden.")
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
          setErrorMsg(
            `Buchung hat Status "${data.booking.status}" und kann nicht gestartet werden.`
          )
          setPhase("error")
        }
      } catch {
        setErrorMsg("Netzwerkfehler beim Laden der Buchung.")
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

  async function patchBooking(action: string) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Fehler.")
        return null
      }
      return data
    } catch {
      toast.error("Netzwerkfehler.")
      return null
    }
  }

  const handleStartTrial = async () => {
    const result = await patchBooking("start-session")
    if (result) {
      setPhase("trial")
      setTimer(300)
      setIsInCall(true)
      toast.success("Session gestartet!")
    }
  }

  const handlePaymentSuccess = () => {
    setPhase("paid")
    setTimer(1800)
    toast.success("Zahlung erfolgreich! Session laeuft weiter.")
  }

  const handleEndCall = async () => {
    await patchBooking("end-session")
    setIsInCall(false)
    setPhase("rating")
    toast.info("Sitzung beendet.")
  }

  const handleSubmitRating = () => {
    toast.success("Bewertung gespeichert! Danke.")
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
            Zurueck zu Sessions
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
            <h1 className="text-lg font-semibold text-foreground">Session starten</h1>
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
                <Star className="size-4 text-amber" />
                <div>
                  <p className="font-medium text-foreground">Dann {booking.price}&euro; / Session</p>
                  <p className="text-xs text-muted-foreground">Entscheide nach der Probezeit</p>
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
              aria-label={isMuted ? "Mikrofon einschalten" : "Mikrofon ausschalten"}
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
              aria-label={isCameraOff ? "Kamera einschalten" : "Kamera ausschalten"}
            >
              {isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
            </button>
          </div>

          <Button
            onClick={handleStartTrial}
            className="h-14 w-full rounded-xl bg-accent text-lg font-bold text-accent-foreground shadow-lg hover:bg-accent/90"
          >
            <Video className="mr-2 size-5" />
            Beitreten
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Video-Raum:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{dailyRoomUrl}</code>
          </p>
        </div>
      </div>
    )
  }

  // ─── Rating ──────────────────────────────────────────────────────────────

  if (phase === "rating") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <Avatar className="size-20 border-4 border-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Session beendet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Wie war deine Erfahrung mit {booking.takumiName}?
          </p>
          {booking.sessionDuration != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Dauer: {booking.sessionDuration} Minuten
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
              aria-label={`${star} Sterne`}
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
          placeholder="Optional: Schreibe eine Bewertung..."
          className="w-full max-w-sm resize-none rounded-xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          rows={3}
        />

        <div className="flex w-full max-w-sm flex-col gap-3">
          <Button
            onClick={handleSubmitRating}
            disabled={rating === 0}
            className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Bewertung abgeben
          </Button>
          <Button
            onClick={() => router.push("/sessions")}
            variant="outline"
            className="h-12 w-full rounded-xl"
          >
            Ueberspringen
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
          Zurueck zu Sessions
        </Button>
      </div>
    )
  }

  // ─── Active call (trial / paid) ───────────────────────────────────────────

  return (
    <>
      <div className="relative flex h-screen flex-col bg-foreground">
        {/* DailyVideoCall loaded client-only via dynamic import (ssr: false) */}
        {isInCall && (
          <DailyVideoCall
            roomUrl={dailyRoomUrl}
            isCameraOff={isCameraOff}
            takumiName={booking.takumiName}
            initials={initials}
          />
        )}

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
                {phase === "trial" ? "Kostenlose Probe" : "Bezahlte Session"}
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
              {phase === "trial" ? "Probe" : "Bezahlt"}
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
              aria-label={isMuted ? "Stummschaltung aufheben" : "Stummschalten"}
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
              aria-label={isCameraOff ? "Kamera einschalten" : "Kamera ausschalten"}
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
              aria-label="Anruf beenden"
            >
              <PhoneOff className="size-6 text-destructive-foreground" />
            </button>

            <button
              onClick={() => toast.info("Meldung gesendet")}
              className="flex size-12 items-center justify-center rounded-full bg-white/20"
              aria-label="Problem melden"
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

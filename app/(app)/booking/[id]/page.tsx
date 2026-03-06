"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ReviewStars } from "@/components/review-stars"
import { BookingCalendar } from "@/components/booking-calendar"
import { PageContainer } from "@/components/page-container"
import { useTakumis } from "@/hooks/use-takumis"
import { notFound } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, CheckCircle, Shield, CreditCard, Clock, Video, Info, Loader2, Calendar,
} from "lucide-react"

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const { takumis, isLoading: isTakumisLoading } = useTakumis()
  const takumi = takumis.find((t) => t.id === id)

  // Show loading state while fetching takumis
  if (isTakumisLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Lade Experten-Profil...</p>
        </div>
      </PageContainer>
    )
  }

  if (!takumi) notFound()

  const [selectedDate, setSelectedDate] = useState("")
  const [selectedStart, setSelectedStart] = useState("")
  const [selectedEnd, setSelectedEnd] = useState("")
  const [note, setNote] = useState("")
  const [isBooking, setIsBooking] = useState(false)

  function handleTimeSelect(date: string, start: string, end: string) {
    setSelectedDate(date)
    setSelectedStart(start)
    setSelectedEnd(end)
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedStart) {
      toast.error("Bitte waehle einen Termin aus.")
      return
    }
    if (!session?.user) {
      toast.error("Bitte zuerst anmelden.")
      router.push("/login?callbackUrl=" + encodeURIComponent(`/booking/${id}`))
      return
    }
    setIsBooking(true)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          takumiId: id,
          date: selectedDate,
          startTime: selectedStart,
          endTime: selectedEnd,
          price: takumi.pricePerSession,
          note,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Buchung erfolgreich erstellt!")
        router.push("/sessions")
      } else {
        // User-friendly error messages
        const errorMsg = data.error?.includes("validation")
          ? "Das Expertenprofil ist unvollstaendig. Bitte waehle einen anderen Termin oder Experten."
          : data.error || "Buchung fehlgeschlagen. Bitte versuche es erneut."
        toast.error(errorMsg)
      }
    } catch {
      toast.error("Netzwerkfehler. Bitte pruefe deine Verbindung.")
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/takumi/${takumi.id}`}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-bold text-foreground">Buchung</h1>
        </div>

        {/* Takumi Summary */}
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
          <Avatar className="size-14 border-2 border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {takumi.avatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">{takumi.name}</span>
              {takumi.verified && <CheckCircle className="size-3.5 text-accent" />}
            </div>
            <span className="text-xs text-muted-foreground">{takumi.subcategory}</span>
            <ReviewStars rating={takumi.rating} />
          </div>
        </div>

        {/* Service Details */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Session-Details</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Video className="size-4" /> Live-Video-Session
              </span>
              <span className="text-foreground">30 Minuten</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" /> Kostenlose Probezeit
              </span>
              <span className="font-medium text-accent">5 Min gratis</span>
            </div>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Preisaufstellung</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">5 Min Probezeit</span>
              <span className="text-accent font-medium">Kostenlos</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">30 Min Session</span>
              <span className="text-foreground">{takumi.pricePerSession}&euro;</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between font-semibold">
              <span className="text-foreground">Maximal</span>
              <span className="text-foreground">{takumi.pricePerSession}&euro;</span>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3">
            <Info className="size-4 shrink-0 text-accent mt-0.5" />
            <p className="text-xs text-accent leading-relaxed">
              Dein Geld wird erst nach deiner Freigabe belastet. Du kannst nach der Probezeit jederzeit abbrechen.
            </p>
          </div>
        </div>

        {/* Date & Time Selection */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="size-4 text-primary" /> Termin waehlen
          </h2>
          <BookingCalendar
            takumiId={id}
            onSelect={handleTimeSelect}
            selectedDate={selectedDate}
            selectedTime={selectedStart}
          />
        </div>

        {/* Selected slot summary */}
        {selectedDate && selectedStart && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <Calendar className="size-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {selectedDate.split("-").reverse().join(".")} um {selectedStart} Uhr
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selectedStart} - {selectedEnd} (30 Min)
              </span>
            </div>
          </div>
        )}

        {/* Note + Book */}
        <form onSubmit={handleBook} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="note" className="text-xs">Nachricht an den Experten (optional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Beschreibe kurz dein Anliegen..."
              className="h-11 rounded-xl"
            />
          </div>

          {/* Cancellation Policy */}
          <div className="flex items-start gap-2 rounded-xl bg-muted p-3">
            <Shield className="size-4 shrink-0 text-primary mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Stornierungsbedingungen</span>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Kostenlose Stornierung bis zum Beginn der Session. Wahrend der 5-Min-Probezeit kannst du jederzeit ohne Kosten abbrechen.
              </p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={!selectedDate || !selectedStart || isBooking}
            className="h-14 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 shadow-lg disabled:opacity-50"
          >
            {isBooking ? (
              <><Loader2 className="size-4 animate-spin mr-2" /> Wird gebucht...</>
            ) : (
              <>Verbindlich buchen &middot; {takumi.pricePerSession}&euro;</>
            )}
          </Button>
        </form>
      </div>
    </PageContainer>
  )
}

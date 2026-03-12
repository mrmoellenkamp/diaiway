"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReviewStars } from "@/components/review-stars"
import { BookingCalendar } from "@/components/booking-calendar"
import { PageContainer } from "@/components/page-container"
import { useTakumis } from "@/hooks/use-takumis"
import { useI18n } from "@/lib/i18n"
import { notFound } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, CheckCircle, Shield, Clock, Video, Info, Loader2, Calendar, CreditCard, RefreshCcw, Mic,
} from "lucide-react"
import { parseBerlinDateTime, isBeyondMaxBookingDays } from "@/lib/date-utils"
import { BookingCheckout } from "@/components/booking-checkout"
import { InstantCallTrigger } from "@/components/instant-call-trigger"
import { cn } from "@/lib/utils"
import type { SlotSelectMeta } from "@/components/booking-calendar"

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useI18n()
  const router = useRouter()
  const { data: session } = useSession()
  const { takumis, isLoading: isTakumisLoading, error: takumisError, mutate: mutateTakumis } = useTakumis()
  const takumi = takumis.find((tk) => tk.id === id)

  const [step, setStep] = useState<"form" | "checkout" | "success">("form")
  const [bookingIdForPayment, setBookingIdForPayment] = useState<string | null>(null)
  const [walletBalanceCents, setWalletBalanceCents] = useState(0)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedStart, setSelectedStart] = useState("")
  const [selectedEnd, setSelectedEnd] = useState("")
  const [note, setNote] = useState("")
  const [callType, setCallType] = useState<"VIDEO" | "VOICE">("VIDEO")
  const [isBooking, setIsBooking] = useState(false)
  const [selectedInSprechzeit, setSelectedInSprechzeit] = useState(false)
  const [selectedSprechzeit, setSelectedSprechzeit] = useState<{ date: string; startTime: string } | null>(null)

  useEffect(() => {
    if (step === "checkout" && session?.user) {
      fetch("/api/wallet/history")
        .then((r) => r.json())
        .then((data) => setWalletBalanceCents(data.wallet?.balance ?? 0))
        .catch(() => {})
    }
  }, [step, session?.user])

  if (isTakumisLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("booking.loading")}</p>
        </div>
      </PageContainer>
    )
  }

  if (takumisError) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-sm text-muted-foreground">{t("booking.networkError")}</p>
          <Button variant="outline" onClick={() => mutateTakumis()} className="gap-2">
            <RefreshCcw className="size-4" />
            {t("common.retry")}
          </Button>
        </div>
      </PageContainer>
    )
  }

  if (!takumi) notFound()

  const priceVideo15 = takumi.priceVideo15Min ?? (takumi.pricePerSession ? takumi.pricePerSession / 2 : 0)
  const priceVoice15 = takumi.priceVoice15Min ?? (takumi.pricePerSession ? takumi.pricePerSession / 2 : 0)
  const pricePer15 = callType === "VOICE" ? priceVoice15 : priceVideo15
  const durationMin = selectedStart && selectedEnd
    ? (() => {
        const [sh, sm] = selectedStart.split(":").map(Number)
        const [eh, em] = selectedEnd.split(":").map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      })()
    : 0
  const slots15 = durationMin / 15
  const totalPrice = Math.round(slots15 * pricePer15 * 100) / 100

  function handleTimeSelect(
    date: string,
    start: string,
    end: string,
    meta?: SlotSelectMeta
  ) {
    // Guard: never allow selecting a slot in the past (Berlin time)
    const slotDateTime = parseBerlinDateTime(date, start)
    if (slotDateTime <= new Date()) {
      toast.error(t("booking.pastSlotError"))
      return
    }
    // 7-Tage-Regel: Buchungen max. 7 Tage im Voraus
    if (isBeyondMaxBookingDays(date, start)) {
      toast.error(t("booking.max7DaysAhead"))
      return
    }
    setSelectedDate(date)
    setSelectedStart(start)
    setSelectedEnd(end)
    setSelectedInSprechzeit(meta?.inSprechzeit ?? false)
    setSelectedSprechzeit(null)
  }

  function handleSelectSprechzeit(date: string, startTime: string) {
    setSelectedSprechzeit({ date, startTime })
    setSelectedDate("")
    setSelectedStart("")
    setSelectedEnd("")
    setSelectedInSprechzeit(false)
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedStart || !selectedEnd) {
      toast.error(t("booking.selectAppointmentError"))
      return
    }
    if (durationMin < 15 || durationMin % 15 !== 0) {
      toast.error(t("booking.durationInvalid"))
      return
    }
    if (totalPrice < 0) {
      toast.error(t("booking.priceInvalid"))
      return
    }
    // Double-check at submit time — slot may have become past while form was open (Berlin time)
    const slotDateTime = parseBerlinDateTime(selectedDate, selectedStart)
    if (slotDateTime <= new Date()) {
      toast.error(t("booking.pastSlotError"))
      setSelectedDate("")
      setSelectedStart("")
      setSelectedEnd("")
      return
    }
    if (isBeyondMaxBookingDays(selectedDate, selectedStart)) {
      toast.error(t("booking.max7DaysAhead"))
      return
    }
    if (!session?.user) {
      toast.error(t("booking.loginRequired"))
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
          callType,
          totalPrice,
          note,
          deferNotification: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setBookingIdForPayment(data.bookingId)
        setStep("checkout")
      } else {
        const errorMsg = data.error?.includes("validation")
          ? t("booking.incompleteProfile")
          : data.error || t("booking.networkError")
        toast.error(errorMsg)
      }
    } catch {
      toast.error(t("booking.networkError"))
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          {step === "checkout" ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setStep("form")}
              aria-label={t("handshake.back")}
            >
              <ArrowLeft className="size-5" />
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link href={`/takumi/${takumi.id}`}>
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
          )}
          <h1 className="text-lg font-bold text-foreground">
            {step === "checkout" ? t("handshake.paymentTitle") : t("booking.title")}
          </h1>
        </div>

        {step === "checkout" && bookingIdForPayment ? (
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {t("handshake.minutesWith", { duration: String(durationMin), name: takumi.name })}
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-sm text-muted-foreground">{t("handshake.amount")}</span>
              <span className="text-lg font-bold text-foreground">
                {totalPrice.toFixed(2)} €
              </span>
            </div>
            <BookingCheckout
              bookingId={bookingIdForPayment}
              takumiName={takumi.name}
              priceInCents={Math.round(totalPrice * 100)}
              walletBalanceCents={walletBalanceCents}
              onSuccess={() => {
                import("@/lib/native-utils").then(({ hapticSuccess }) => hapticSuccess())
                toast.success(t("booking.successTitle"))
                window.location.href = "/sessions?tab=upcoming"
              }}
              onError={(err) => {
                toast.error(err)
                setStep("form")
              }}
            />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("booking.redirectFallback")}{" "}
              <Link href="/sessions?tab=upcoming" className="font-medium text-primary underline underline-offset-2">
                {t("booking.successContinue")}
              </Link>
            </p>
          </div>
        ) : (
          <>
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

        {/* Gesprächsmodus – über Termin-Auswahl */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Gesprächsmodus</h2>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row">
            <button
              type="button"
              onClick={() => setCallType("VIDEO")}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all cursor-pointer",
                "hover:bg-accent/50 active:scale-95",
                callType === "VIDEO"
                  ? "scale-100 border-primary bg-primary/5 shadow-[0_0_12px_rgba(6,78,59,0.15)]"
                  : "scale-[0.98] border-border bg-card hover:border-primary/40"
              )}
            >
              <Video className={cn("size-5", callType === "VIDEO" && "text-primary")} />
              <span className="text-sm font-medium text-foreground">Video-Call</span>
              <span className="text-[11px] text-muted-foreground">
                {priceVideo15.toFixed(2)} € / 15 Min
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCallType("VOICE")}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all cursor-pointer",
                "hover:bg-accent/50 active:scale-95",
                callType === "VOICE"
                  ? "scale-100 border-primary bg-primary/5 shadow-[0_0_12px_rgba(6,78,59,0.15)]"
                  : "scale-[0.98] border-border bg-card hover:border-primary/40"
              )}
            >
              <Mic className={cn("size-5", callType === "VOICE" && "text-primary")} />
              <span className="text-sm font-medium text-foreground">Voice-Call</span>
              <span className="text-[11px] text-muted-foreground">
                {priceVoice15.toFixed(2)} € / 15 Min
              </span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Der Modus kann später nicht mehr geändert werden.
          </p>
        </div>

        {/* Preisaufstellung – Tariffierung Video/Voice */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("booking.priceBreakdown")}</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Video className="size-4" /> Video-Call
              </span>
              <span className="text-foreground">{priceVideo15.toFixed(2)} € / 15 Min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mic className="size-4" /> Voice-Call
              </span>
              <span className="text-foreground">{priceVoice15.toFixed(2)} € / 15 Min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" /> {t("booking.minDuration")}
              </span>
              <span className="text-foreground">15 Min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("booking.trialMinutes")}</span>
              <span className="text-accent font-medium">{t("booking.free")}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3">
            <Info className="size-4 shrink-0 text-accent mt-0.5" />
            <p className="text-xs text-accent leading-relaxed">
              {t("booking.escrowNotice")}
            </p>
          </div>
        </div>

        {/* Hinweis: Takumi im Gespräch */}
        {takumi.liveStatus === "in_call" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t("booking.takumiInCall")}
            </p>
          </div>
        )}

        {/* Date & Time Selection */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="size-4 text-primary" /> {t("booking.chooseAppointment")}
          </h2>
          <BookingCalendar
            takumiId={id}
            onSelect={handleTimeSelect}
            onSelectSprechzeit={handleSelectSprechzeit}
            selectedDate={selectedDate}
            selectedTime={selectedStart}
            selectedSprechzeit={selectedSprechzeit}
          />
        </div>

        {/* Sprechstunde: Direkt anrufen ODER Termin buchen – beide Optionen nebeneinander */}
        {(selectedInSprechzeit || selectedSprechzeit) && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-3">
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              {t("booking.sprechzeitHint")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {takumi.liveStatus === "available" && (
                <InstantCallTrigger
                  takumi={takumi}
                  variant="profile"
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white order-1"
                />
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedSprechzeit(null)
                  setSelectedInSprechzeit(false)
                }}
                className={cn(
                  "h-12 rounded-xl border-emerald-500/50 bg-white/80 hover:bg-white dark:bg-card",
                  takumi.liveStatus === "available" ? "order-2" : "order-1"
                )}
              >
                <Calendar className="size-4 shrink-0" />
                {t("takumiPage.bookAppointment")}
              </Button>
            </div>
            {takumi.liveStatus === "in_call" && (
              <p className="text-xs text-muted-foreground">
                {t("booking.takumiInCall")}
              </p>
            )}
          </div>
        )}

        {/* Termindetails – Buchungszusammenfassung unterhalb des Kalenders (aktualisiert bei jedem Klick) */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Termindetails</h2>
          {selectedDate && selectedStart && selectedEnd ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Calendar className="size-4 text-primary shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {t("booking.selectedSlot")
                      .replace("{date}", selectedDate.split("-").reverse().join("."))
                      .replace("{time}", selectedStart)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("booking.selectedSlotRange")
                      .replace("{start}", selectedStart)
                      .replace("{end}", selectedEnd)
                      .replace("{duration}", String(durationMin))}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  {durationMin} Min · {callType === "VIDEO" ? "Video" : "Voice"} ({slots15} × {pricePer15.toFixed(2)} €)
                </span>
                <span className="text-base font-bold text-foreground">
                  {totalPrice.toFixed(2)} €
                </span>
              </div>
            </div>
          ) : selectedSprechzeit ? (
            <p className="text-sm text-muted-foreground py-2">
              {t("booking.sprechzeitSelectedHint")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Wähle einen Termin im Kalender – die Zusammenfassung und der Preis werden hier angezeigt.
            </p>
          )}
        </div>

        {/* Note + Book */}
        <form onSubmit={handleBook} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="note" className="text-xs">{t("booking.noteLabel")}</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("booking.notePlaceholder")}
              className="h-11 rounded-xl"
            />
          </div>

          {/* Cancellation Policy – dynamic based on expert's settings */}
          {(() => {
            const cp = takumi.cancelPolicy
            const freeHours = cp?.freeHours ?? 24
            const feePercent = cp?.feePercent ?? 0
            let policyText = ""
            if (freeHours === 0 && feePercent === 0) {
              policyText = t("booking.cancelPolicyFreeAlways")
            } else if (freeHours === 0 && feePercent > 0) {
              policyText = t("booking.cancelPolicyNoFree").replace("{percent}", String(feePercent))
            } else if (feePercent === 0) {
              policyText = t("booking.cancelPolicyFreeWindow").replace("{h}", String(freeHours))
            } else {
              policyText = t("booking.cancelPolicyFull")
                .replace("{h}", String(freeHours))
                .replace("{percent}", String(feePercent))
            }
            return (
              <div className="flex items-start gap-2 rounded-xl bg-muted p-3">
                <Shield className="size-4 shrink-0 text-primary mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">{t("booking.cancellationTitle")}</span>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{policyText}</p>
                </div>
              </div>
            )
          })()}

          <Button
            type="submit"
            disabled={!selectedDate || !selectedStart || totalPrice < 0 || isBooking}
            className="h-14 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 shadow-lg disabled:opacity-50"
          >
            {isBooking ? (
              <><Loader2 className="size-4 animate-spin mr-2" /> {t("booking.bookingInProgress")}</>
            ) : (
              <>{t("booking.bookButton").replace("{price}", totalPrice > 0 ? totalPrice.toFixed(2) : "–")}</>
            )}
          </Button>
        </form>
          </>
        )}
      </div>
    </PageContainer>
  )
}

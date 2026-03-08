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
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft, CheckCircle, Shield, Clock, Video, Mic, Info, Loader2, Calendar, CreditCard, RefreshCcw,
} from "lucide-react"
import { parseBerlinDateTime, isBeyondMaxBookingDays } from "@/lib/date-utils"
import { BookingCheckout } from "@/components/booking-checkout"

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
  const [callType, setCallType] = useState<"VIDEO" | "VOICE">("VIDEO")
  const [note, setNote] = useState("")
  const [isBooking, setIsBooking] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

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
  const durationMin = selectedStart && selectedEnd
    ? (() => {
        const [sh, sm] = selectedStart.split(":").map(Number)
        const [eh, em] = selectedEnd.split(":").map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      })()
    : 0
  const slots15 = durationMin / 15
  const totalPrice =
    callType === "VIDEO"
      ? Math.round(slots15 * priceVideo15 * 100) / 100
      : Math.round(slots15 * priceVoice15 * 100) / 100

  function handleTimeSelect(date: string, start: string, end: string) {
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
    if (totalPrice < 1) {
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

  function handleSuccessContinue() {
    setShowSuccessDialog(false)
    router.push("/sessions?tab=upcoming")
  }

  return (
    <PageContainer>
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("booking.successTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("booking.successInfo", { name: takumi.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleSuccessContinue}>
              {t("booking.successContinue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
                setStep("success")
                setShowSuccessDialog(true)
              }}
              onError={(err) => {
                toast.error(err)
                setStep("form")
              }}
            />
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

        {/* Service Details & Call Type */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("booking.sessionDetails")}</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" /> {t("booking.minDuration")}
              </span>
              <span className="text-foreground">15 Min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Video className="size-4" /> {t("booking.videoSessionOption")}
              </span>
              <span className="text-foreground">{priceVideo15.toFixed(2)} € / 15 Min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mic className="size-4" /> {t("booking.voiceCallOption")}
              </span>
              <span className="text-foreground">{priceVoice15.toFixed(2)} € / 15 Min</span>
            </div>
          </div>
        </div>

        {/* Call Type Selection (after time chosen) */}
        {selectedDate && selectedStart && (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <h2 className="text-sm font-semibold text-foreground">{t("booking.callTypeTitle")}</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCallType("VIDEO")}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm transition-colors ${
                  callType === "VIDEO"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <Video className="size-6" />
                <span className="font-medium">{t("booking.videoSession")}</span>
                <span className="text-xs text-muted-foreground">
                  {priceVideo15.toFixed(2)} € / 15 Min
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCallType("VOICE")}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm transition-colors ${
                  callType === "VOICE"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <Mic className="size-6" />
                <span className="font-medium">{t("booking.voiceCall")}</span>
                <span className="text-xs text-muted-foreground">
                  {priceVoice15.toFixed(2)} € / 15 Min
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Price Breakdown – dynamisch */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("booking.priceBreakdown")}</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("booking.trialMinutes")}</span>
              <span className="text-accent font-medium">{t("booking.free")}</span>
            </div>
            {selectedDate && selectedStart && durationMin > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {callType === "VIDEO" ? t("booking.videoSession") : t("booking.voiceCall")} · {durationMin} Min
                  </span>
                  <span className="text-foreground">
                    {slots15} × {callType === "VIDEO" ? priceVideo15.toFixed(2) : priceVoice15.toFixed(2)} €
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-foreground">{t("booking.total")}</span>
                  <span className="text-foreground">{totalPrice.toFixed(2)} €</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t("booking.selectSlotForPrice")}</p>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-accent/10 p-3">
            <Info className="size-4 shrink-0 text-accent mt-0.5" />
            <p className="text-xs text-accent leading-relaxed">
              {t("booking.escrowNotice")}
            </p>
          </div>
        </div>

        {/* Date & Time Selection */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="size-4 text-primary" /> {t("booking.chooseAppointment")}
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
                {t("booking.selectedSlot")
                  .replace("{date}", selectedDate.split("-").reverse().join("."))
                  .replace("{time}", selectedStart)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {(() => {
                  const [sh, sm] = selectedStart.split(":").map(Number)
                  const [eh, em] = (selectedEnd || selectedStart).split(":").map(Number)
                  const duration = (eh * 60 + em) - (sh * 60 + sm)
                  return t("booking.selectedSlotRange")
                    .replace("{start}", selectedStart)
                    .replace("{end}", selectedEnd || selectedStart)
                    .replace("{duration}", String(duration))
                })()}
              </span>
            </div>
          </div>
        )}

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
            disabled={!selectedDate || !selectedStart || totalPrice < 1 || isBooking}
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

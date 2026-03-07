"use client"

import { use, useState } from "react"
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
  ArrowLeft, CheckCircle, Shield, Clock, Video, Info, Loader2, Calendar,
} from "lucide-react"
import { parseBerlinDateTime } from "@/lib/date-utils"

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useI18n()
  const router = useRouter()
  const { data: session } = useSession()
  const { takumis, isLoading: isTakumisLoading } = useTakumis()
  const takumi = takumis.find((tk) => tk.id === id)

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

  if (!takumi) notFound()

  const [selectedDate, setSelectedDate] = useState("")
  const [selectedStart, setSelectedStart] = useState("")
  const [selectedEnd, setSelectedEnd] = useState("")
  const [note, setNote] = useState("")
  const [isBooking, setIsBooking] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  function handleTimeSelect(date: string, start: string, end: string) {
    // Guard: never allow selecting a slot in the past (Berlin time)
    const slotDateTime = parseBerlinDateTime(date, start)
    if (slotDateTime <= new Date()) {
      toast.error(t("booking.pastSlotError"))
      return
    }
    setSelectedDate(date)
    setSelectedStart(start)
    setSelectedEnd(end)
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedStart) {
      toast.error(t("booking.selectAppointmentError"))
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
          price: takumi.pricePerSession,
          note,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || t("booking.bookButton").replace("{price}", String(takumi.pricePerSession)))
        setShowSuccessDialog(true)
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
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/takumi/${takumi.id}`}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-bold text-foreground">{t("booking.title")}</h1>
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
          <h2 className="text-sm font-semibold text-foreground">{t("booking.sessionDetails")}</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Video className="size-4" /> {t("booking.liveVideoSession")}
              </span>
              <span className="text-foreground">30 Min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" /> {t("booking.freeTrialTime")}
              </span>
              <span className="font-medium text-accent">{t("booking.freeMinutes")}</span>
            </div>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("booking.priceBreakdown")}</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("booking.trialMinutes")}</span>
              <span className="text-accent font-medium">{t("booking.free")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("booking.sessionMinutes")}</span>
              <span className="text-foreground">{takumi.pricePerSession}&euro;</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between font-semibold">
              <span className="text-foreground">{t("booking.maximum")}</span>
              <span className="text-foreground">{takumi.pricePerSession}&euro;</span>
            </div>
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
            disabled={!selectedDate || !selectedStart || isBooking}
            className="h-14 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 shadow-lg disabled:opacity-50"
          >
            {isBooking ? (
              <><Loader2 className="size-4 animate-spin mr-2" /> {t("booking.bookingInProgress")}</>
            ) : (
              <>{t("booking.bookButton").replace("{price}", String(takumi.pricePerSession))}</>
            )}
          </Button>
        </form>
      </div>
    </PageContainer>
  )
}

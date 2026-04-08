"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, CalendarPlus, Loader2 } from "lucide-react"
import { Capacitor } from "@capacitor/core"
import { useIsNativeCapacitor } from "@/hooks/use-is-native-capacitor"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  buildGoogleCalendarEventUrl,
  canOfferCalendarExport,
  type BookingCalendarEligibilityFields,
} from "@/lib/booking-calendar"
import { shareBookingIcsViaNativeSheet } from "@/lib/native-utils"

export type BookingCalendarActionsBooking = BookingCalendarEligibilityFields & {
  userName: string
  takumiName: string
  callType?: "VIDEO" | "VOICE"
  note?: string
}

function parseContentDispositionFilename(cd: string | null): string | null {
  if (!cd) return null
  const star = cd.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/;$/, ""))
    } catch {
      /* continue */
    }
  }
  const q = cd.match(/filename="([^"]+)"/i)
  if (q) return q[1]
  const u = cd.match(/filename=([^;\s]+)/i)
  return u?.[1]?.replace(/^"|"$/g, "") ?? null
}

export function BookingCalendarActions({
  bookingId,
  isExpertView,
  booking,
  className,
}: {
  bookingId: string
  isExpertView: boolean
  booking: BookingCalendarActionsBooking
  className?: string
}) {
  const { t } = useI18n()
  const isNative = useIsNativeCapacitor()
  const [origin, setOrigin] = useState("")
  const [icsBusy, setIcsBusy] = useState(false)

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "")
  }, [])

  const show = canOfferCalendarExport(booking)
  const partnerForCalendar = isExpertView ? booking.userName : booking.takumiName
  const callLabel = booking.callType === "VOICE" ? "Voice" : "Video"
  const calendarTitle = `diaiway · ${callLabel} · ${partnerForCalendar}`
  const sessionAbsUrl = origin ? `${origin}/session/${bookingId}` : ""
  const googleCalendarUrl = useMemo(() => {
    if (!show || !sessionAbsUrl) return ""
    return buildGoogleCalendarEventUrl({
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      title: calendarTitle,
      details: `Session mit ${partnerForCalendar} (diaiway)\n\n${sessionAbsUrl}${booking.note?.trim() ? `\n\n${booking.note.trim()}` : ""}`,
      location: sessionAbsUrl,
    })
  }, [
    show,
    sessionAbsUrl,
    booking.date,
    booking.startTime,
    booking.endTime,
    booking.note,
    calendarTitle,
    partnerForCalendar,
  ])

  async function handleDownloadIcs() {
    if (icsBusy || !bookingId) return
    setIcsBusy(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/calendar.ics`, {
        credentials: "same-origin",
      })
      if (!res.ok) {
        let msg = t("booking.calendarDownloadFailed")
        const ct = res.headers.get("content-type") ?? ""
        if (ct.includes("application/json")) {
          try {
            const j = (await res.json()) as { error?: string }
            if (j.error) msg = j.error
          } catch {
            /* keep default */
          }
        }
        toast.error(msg)
        return
      }

      const blob = await res.blob()
      const filename =
        parseContentDispositionFilename(res.headers.get("Content-Disposition")) ??
        `diaiway-termin-${booking.date.replace(/[^0-9-]/g, "") || "termin"}.ics`

      const file = new File([blob], filename, { type: "text/calendar;charset=utf-8" })

      if (Capacitor.isNativePlatform()) {
        const native = await shareBookingIcsViaNativeSheet({
          blob,
          fileName: filename,
          title: calendarTitle,
          dialogTitle: t("booking.calendarIcs"),
        })
        if (native === "shared" || native === "cancelled") return
      }

      let canShareFile = false
      try {
        canShareFile =
          typeof navigator !== "undefined" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
      } catch {
        canShareFile = false
      }

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: calendarTitle,
          })
          return
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return
          /* fall through to anchor download */
        }
      }

      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = filename
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 60_000)
    } catch {
      toast.error(t("booking.calendarDownloadFailed"))
    } finally {
      setIcsBusy(false)
    }
  }

  if (!show || !bookingId) return null

  const openGoogleInBrowser = isNative && typeof window !== "undefined" && googleCalendarUrl

  async function handleOpenGoogle() {
    if (!googleCalendarUrl) return
    if (Capacitor.isNativePlatform()) {
      try {
        const { Browser } = await import("@capacitor/browser")
        await Browser.open({ url: googleCalendarUrl, presentationStyle: "popover" })
        return
      } catch {
        /* fall through */
      }
    }
    window.open(googleCalendarUrl, "_blank", "noopener,noreferrer")
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn("h-8 border-border gap-1.5", isNative ? "px-2.5 text-xs" : "h-9")}
        disabled={icsBusy}
        onClick={() => void handleDownloadIcs()}
      >
        {icsBusy ? (
          <Loader2 className="size-3.5 animate-spin shrink-0" />
        ) : (
          <CalendarPlus className="size-3.5 shrink-0" />
        )}
        {isNative ? (
          <span>.ics</span>
        ) : (
          <>
            <span className="hidden sm:inline">{t("booking.calendarIcs")}</span>
            <span className="sm:hidden">.ics</span>
          </>
        )}
      </Button>
      {googleCalendarUrl ? (
        openGoogleInBrowser ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-8 border-border gap-1.5", isNative ? "px-2.5 text-xs" : "h-9")}
            onClick={() => void handleOpenGoogle()}
          >
            <Calendar className="size-3.5 shrink-0" />
            {isNative ? (
              <span>Google</span>
            ) : (
              <>
                <span className="hidden sm:inline">{t("booking.calendarGoogle")}</span>
                <span className="sm:hidden">G</span>
              </>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className={cn("h-8 border-border gap-1.5", isNative ? "px-2.5 text-xs" : "h-9")}
            asChild
          >
            <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
              <Calendar className="size-3.5 shrink-0" />
              {isNative ? (
                <span>Google</span>
              ) : (
                <>
                  <span className="hidden sm:inline">{t("booking.calendarGoogle")}</span>
                  <span className="sm:hidden">G</span>
                </>
              )}
            </a>
          </Button>
        )
      ) : null}
    </div>
  )
}

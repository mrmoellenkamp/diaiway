"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  buildGoogleCalendarEventUrl,
  canOfferCalendarExport,
  type BookingCalendarEligibilityFields,
} from "@/lib/booking-calendar"

export type BookingCalendarActionsBooking = BookingCalendarEligibilityFields & {
  userName: string
  takumiName: string
  callType?: "VIDEO" | "VOICE"
  note?: string
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
  const [origin, setOrigin] = useState("")

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

  if (!show || !bookingId) return null

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button size="sm" variant="outline" className="h-9 border-border" asChild>
        <a href={`/api/bookings/${bookingId}/calendar.ics`} download>
          <CalendarPlus className="mr-1.5 size-3.5" />
          <span className="hidden sm:inline">{t("booking.calendarIcs")}</span>
          <span className="sm:hidden">.ics</span>
        </a>
      </Button>
      {googleCalendarUrl ? (
        <Button size="sm" variant="outline" className="h-9 border-border" asChild>
          <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer">
            <Calendar className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">{t("booking.calendarGoogle")}</span>
            <span className="sm:hidden">G</span>
          </a>
        </Button>
      ) : null}
    </div>
  )
}

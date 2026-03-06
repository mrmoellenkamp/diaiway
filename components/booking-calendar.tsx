"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react"

interface TimeSlot { start: string; end: string }
interface BlockedSlot { startTime: string; endTime: string; status: string }

interface BookingCalendarProps {
  takumiId: string
  onSelect: (date: string, startTime: string, endTime: string) => void
  selectedDate?: string
  selectedTime?: string
}

const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
const MONTH_NAMES = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Generate 30-min time slots from availability */
function generateTimeSlots(avail: TimeSlot[]): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = []
  for (const a of avail) {
    let [h, m] = a.start.split(":").map(Number)
    const [eh, em] = a.end.split(":").map(Number)
    while (h < eh || (h === eh && m < em)) {
      const start = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      m += 30
      if (m >= 60) { h += 1; m -= 60 }
      const end = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      if (h < eh || (h === eh && m <= em)) {
        slots.push({ start, end })
      }
    }
  }
  return slots
}

function isSlotBlocked(slot: { start: string; end: string }, blocked: BlockedSlot[]): boolean {
  return blocked.some((b) => b.startTime < slot.end && b.endTime > slot.start)
}

export function BookingCalendar({ takumiId, onSelect, selectedDate, selectedTime }: BookingCalendarProps) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [pickedDate, setPickedDate] = useState(selectedDate || "")
  const [avail, setAvail] = useState<Record<number, TimeSlot[]>>({})
  const [dateSlots, setDateSlots] = useState<TimeSlot[]>([]) // resolved slots for picked date
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [loadingAvail, setLoadingAvail] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Load takumi weekly availability (for calendar day highlighting)
  useEffect(() => {
    setLoadingAvail(true)
    fetch(`/api/availability?takumiId=${takumiId}`)
      .then((r) => r.json())
      .then((data) => {
        setAvail(data.slots || {})
      })
      .catch(() => {})
      .finally(() => setLoadingAvail(false))
  }, [takumiId])

  // Load resolved slots for picked date (considers rules + exceptions)
  useEffect(() => {
    if (!pickedDate) return
    setLoadingSlots(true)
    
    // Fetch both: resolved availability for date + blocked bookings
    Promise.all([
      fetch(`/api/availability?takumiId=${takumiId}&date=${pickedDate}`).then(r => r.json()),
      fetch(`/api/bookings/slots?takumiId=${takumiId}&date=${pickedDate}`).then(r => r.json()),
    ])
      .then(([availData, bookingsData]) => {
        setDateSlots(availData.slots || [])
        setBlockedSlots(bookingsData.blockedSlots || [])
      })
      .catch(() => {})
      .finally(() => setLoadingSlots(false))
  }, [takumiId, pickedDate])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days: (number | null)[] = Array(firstDay).fill(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [viewMonth, viewYear])

  // Time slots for picked date (from resolved dateSlots)
  const timeSlots = useMemo(() => {
    if (!pickedDate || dateSlots.length === 0) return []
    return generateTimeSlots(dateSlots)
  }, [pickedDate, dateSlots])

  function isDayAvailable(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day)
    if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return false
    const dow = d.getDay()
    return (avail[dow] || []).length > 0
  }

  function handlePickDate(day: number) {
    const dateStr = formatDateStr(new Date(viewYear, viewMonth, day))
    setPickedDate(dateStr)
    setBlockedSlots([])
  }

  if (loadingAvail) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
            else setViewMonth(viewMonth - 1)
          }}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
            else setViewMonth(viewMonth + 1)
          }}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_SHORT.map((d) => (
          <span key={d} className="text-[10px] font-medium text-muted-foreground">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const dateStr = formatDateStr(new Date(viewYear, viewMonth, day))
          const available = isDayAvailable(day)
          const isPicked = dateStr === pickedDate
          const isToday = dateStr === formatDateStr(today)
          return (
            <button
              key={day}
              onClick={() => available && handlePickDate(day)}
              disabled={!available}
              className={`flex size-9 items-center justify-center rounded-lg text-xs font-medium transition-colors
                ${isPicked ? "bg-primary text-primary-foreground shadow-sm" : ""}
                ${!isPicked && available ? "text-foreground hover:bg-primary/10" : ""}
                ${!available ? "text-muted-foreground/40 cursor-not-allowed" : ""}
                ${isToday && !isPicked ? "ring-1 ring-primary/30" : ""}
              `}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Time slots */}
      {pickedDate && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            Verfuegbare Zeiten am {pickedDate.split("-").reverse().join(".")}
          </h3>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-primary" />
            </div>
          ) : timeSlots.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Keine Verfuegbarkeit an diesem Tag.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {timeSlots.map((slot) => {
                const blocked = isSlotBlocked(slot, blockedSlots)
                const isSelected = selectedTime === slot.start && selectedDate === pickedDate
                return (
                  <button
                    key={slot.start}
                    disabled={blocked}
                    onClick={() => onSelect(pickedDate, slot.start, slot.end)}
                    className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors
                      ${blocked ? "border-border/40 bg-muted/50 text-muted-foreground/50 cursor-not-allowed" : ""}
                      ${!blocked && isSelected ? "border-primary bg-primary text-primary-foreground" : ""}
                      ${!blocked && !isSelected ? "border-border/60 bg-card text-foreground hover:border-primary/40 hover:bg-primary/5" : ""}
                    `}
                  >
                    {blocked && <Lock className="size-2.5" />}
                    {slot.start}
                  </button>
                )
              })}
            </div>
          )}

          {blockedSlots.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Lock className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Grau = bereits angefragt oder bestaetigt
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Loader2, Lock, Clock } from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────

interface TimeSlot    { start: string; end: string }
interface BlockedSlot { startTime: string; endTime: string; status: string }

export interface BookingCalendarProps {
  takumiId: string
  onSelect: (date: string, startTime: string, endTime: string) => void
  selectedDate?: string
  selectedTime?: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_SHORT_MON_FIRST = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

// Available booking durations (minutes)
const DURATIONS = [15, 30, 45, 60, 90, 120] as const
type Duration = (typeof DURATIONS)[number]

const DURATION_LABELS: Record<Duration, string> = {
  15:  "15 Min",
  30:  "30 Min",
  45:  "45 Min",
  60:  "60 Min",
  90:  "90 Min",
  120: "2 Std",
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
}

/**
 * Generate 15-minute-interval start times within an availability window.
 * Returns plain start times (endTime computed from duration when user selects).
 */
function generateStartTimes(avail: TimeSlot[], durationMin: number): string[] {
  const times: string[] = []
  for (const a of avail) {
    const startMins = timeToMinutes(a.start)
    const endMins   = timeToMinutes(a.end)
    for (let t = startMins; t + durationMin <= endMins; t += 15) {
      times.push(minutesToTime(t))
    }
  }
  return times
}

/**
 * Returns true if the [start, start+duration) window overlaps with any blocked slot.
 */
function isWindowBlocked(startTime: string, durationMin: number, blocked: BlockedSlot[]): boolean {
  const s = timeToMinutes(startTime)
  const e = s + durationMin
  return blocked.some((b) => {
    const bs = timeToMinutes(b.startTime)
    const be = timeToMinutes(b.endTime)
    return s < be && e > bs
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BookingCalendar({
  takumiId,
  onSelect,
  selectedDate,
  selectedTime,
}: BookingCalendarProps) {
  const today = new Date()

  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [pickedDate, setPickedDate] = useState(selectedDate || "")
  const [duration, setDuration]   = useState<Duration>(60)

  // Weekly availability (for fast day-greying in the calendar)
  const [weeklyAvail, setWeeklyAvail] = useState<Record<number, TimeSlot[]>>({})

  // Resolved slots + blocked bookings for the picked date
  const [dateSlots,    setDateSlots]    = useState<TimeSlot[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])

  const [loadingAvail,  setLoadingAvail]  = useState(true)
  const [loadingSlots,  setLoadingSlots]  = useState(false)

  // ── Load weekly default availability ───────────────────────────────────
  useEffect(() => {
    setLoadingAvail(true)
    fetch(`/api/availability?takumiId=${takumiId}`)
      .then((r) => r.json())
      .then((data) => setWeeklyAvail(data.slots || {}))
      .catch(() => {})
      .finally(() => setLoadingAvail(false))
  }, [takumiId])

  // ── Load resolved slots + blocked slots for picked date ────────────────
  useEffect(() => {
    if (!pickedDate) return
    setLoadingSlots(true)
    setDateSlots([])
    setBlockedSlots([])
    Promise.all([
      fetch(`/api/availability?takumiId=${takumiId}&date=${pickedDate}`).then((r) => r.json()),
      fetch(`/api/bookings/slots?takumiId=${takumiId}&date=${pickedDate}`).then((r) => r.json()),
    ])
      .then(([availData, bookingsData]) => {
        setDateSlots(availData.slots || [])
        setBlockedSlots(bookingsData.blockedSlots || [])
      })
      .catch(() => {})
      .finally(() => setLoadingSlots(false))
  }, [takumiId, pickedDate])

  // ── Calendar grid ──────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    let firstDay = new Date(viewYear, viewMonth, 1).getDay()
    firstDay = (firstDay + 6) % 7 // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days: (number | null)[] = Array(firstDay).fill(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [viewMonth, viewYear])

  // Quick check: is a day potentially available (based on weekly defaults only)?
  function isDayAvailable(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (d < todayStart) return false
    const dow = d.getDay()
    return (weeklyAvail[dow] || []).length > 0
  }

  // ── Available start times for picked date ──────────────────────────────
  const startTimes = useMemo(
    () => generateStartTimes(dateSlots, duration),
    [dateSlots, duration]
  )

  function handlePickDate(day: number) {
    const dateStr = formatDateStr(new Date(viewYear, viewMonth, day))
    setPickedDate(dateStr)
  }

  function handleSelectTime(startTime: string) {
    const endTime = minutesToTime(timeToMinutes(startTime) + duration)
    onSelect(pickedDate, startTime, endTime)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loadingAvail) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    )
  }

  const todayStr = formatDateStr(today)

  return (
    <div className="flex flex-col gap-5">

      {/* ── Month navigation ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* ── Day headers (Mon-first) ───────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_SHORT_MON_FIRST.map((d) => (
          <span key={d} className="text-[10px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
      </div>

      {/* ── Calendar days ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const dateStr   = formatDateStr(new Date(viewYear, viewMonth, day))
          const available = isDayAvailable(day)
          const isPicked  = dateStr === pickedDate
          const isToday   = dateStr === todayStr
          return (
            <button
              key={day}
              onClick={() => available && handlePickDate(day)}
              disabled={!available}
              className={[
                "flex size-9 items-center justify-center rounded-xl text-xs font-medium transition-colors",
                isPicked  ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30" : "",
                !isPicked && available ? "text-foreground hover:bg-primary/10 cursor-pointer" : "",
                !available ? "cursor-not-allowed text-muted-foreground/30" : "",
                isToday && !isPicked ? "ring-1 ring-primary/40 font-bold text-primary" : "",
              ].join(" ")}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* ── Duration selector ─────────────────────────────────────────── */}
      {pickedDate && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">Sitzungsdauer</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  duration === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-card text-foreground hover:border-primary/40 hover:bg-primary/5",
                ].join(" ")}
              >
                {DURATION_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Time slots for picked date ────────────────────────────────── */}
      {pickedDate && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            Verfügbare Zeiten am {pickedDate.split("-").reverse().join(".")}
          </h3>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-primary" />
            </div>
          ) : startTimes.length === 0 ? (
            <p className="rounded-lg bg-muted/60 px-3 py-3 text-xs text-muted-foreground">
              Keine freien Zeiten für {DURATION_LABELS[duration]} an diesem Tag.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {startTimes.map((startTime) => {
                const blocked    = isWindowBlocked(startTime, duration, blockedSlots)
                const endTime    = minutesToTime(timeToMinutes(startTime) + duration)
                const isSelected = selectedTime === startTime && selectedDate === pickedDate
                return (
                  <button
                    key={startTime}
                    disabled={blocked}
                    onClick={() => handleSelectTime(startTime)}
                    className={[
                      "flex items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors",
                      blocked
                        ? "cursor-not-allowed border-border/30 bg-muted/50 text-muted-foreground/40"
                        : isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border/60 bg-card text-foreground hover:border-primary/40 hover:bg-primary/5",
                    ].join(" ")}
                    title={blocked ? "Bereits gebucht" : `${startTime} – ${endTime}`}
                  >
                    {blocked && <Lock className="size-2.5 shrink-0" />}
                    {startTime}
                  </button>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Lock className="size-2.5" /> Bereits gebucht
            </span>
            {selectedDate === pickedDate && selectedTime && (
              <Badge variant="outline" className="text-[10px]">
                Gewählt: {selectedTime} – {minutesToTime(timeToMinutes(selectedTime) + duration)}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

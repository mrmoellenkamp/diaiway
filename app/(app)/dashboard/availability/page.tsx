"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { PageContainer } from "@/components/page-container"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Trash2, Loader2, Save, Clock, Calendar,
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  CalendarX2, CalendarDays, Info,
} from "lucide-react"
import {
  resolveSlots,
  EMPTY_WEEKLY_SLOTS,
  getISOWeek,
  type WeeklySlots,
  type ITimeSlot,
  type IWeeklyRule,
  type IDateException,
  type IAvailabilityData,
} from "@/lib/availability-utils"

// ─── Constants ─────────────────────────────────────────────────────────────

const DAY_NAMES  = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0]
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

type Slots = Record<number, ITimeSlot[]>
const EMPTY_SLOTS: Slots = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

interface Booking {
  id: string
  userName: string
  date: string
  startTime: string
  endTime: string
  status: "pending" | "confirmed" | "declined" | "cancelled" | "active" | "completed"
  statusToken: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  return `${d}.${m}.${y}`
}

// ─── WeeklySlotsEditor — 15-min interval time inputs ──────────────────────

function WeeklySlotsEditor({
  slots,
  onChange,
}: {
  slots: Slots
  onChange: (s: Slots) => void
}) {
  const addSlot = (day: number) =>
    onChange({ ...slots, [day]: [...(slots[day] || []), { start: "09:00", end: "17:00" }] })

  const removeSlot = (day: number, idx: number) =>
    onChange({ ...slots, [day]: slots[day].filter((_, i) => i !== idx) })

  const changeSlot = (day: number, idx: number, field: "start" | "end", value: string) =>
    onChange({ ...slots, [day]: slots[day].map((s, i) => (i === idx ? { ...s, [field]: value } : s)) })

  const toggleDay = (day: number) => {
    if ((slots[day] || []).length > 0) {
      onChange({ ...slots, [day]: [] })
    } else {
      onChange({ ...slots, [day]: [{ start: "09:00", end: "17:00" }] })
    }
  }

  return (
    <div className="flex flex-col">
      {ORDERED_DAYS.map((day) => {
        const daySlots = slots[day] || []
        const isActive = daySlots.length > 0
        return (
          <div
            key={day}
            className={`flex flex-col gap-2 rounded-lg px-3 py-3 transition-colors ${isActive ? "bg-primary/5" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={isActive}
                  onCheckedChange={() => toggleDay(day)}
                  className="scale-90"
                />
                <span className={`w-24 text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {DAY_NAMES[day]}
                </span>
              </div>
              {isActive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs text-primary"
                  onClick={() => addSlot(day)}
                >
                  <Plus className="size-3" /> Zeitblock
                </Button>
              ) : (
                <span className="text-xs italic text-muted-foreground">Nicht verfügbar</span>
              )}
            </div>

            {isActive &&
              daySlots.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2 pl-11">
                  <input
                    type="time"
                    step="900"
                    value={slot.start}
                    onChange={(e) => changeSlot(day, idx, "start", e.target.value)}
                    className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="time"
                    step="900"
                    value={slot.end}
                    onChange={(e) => changeSlot(day, idx, "end", e.target.value)}
                    className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {daySlots.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive/60 hover:text-destructive"
                      onClick={() => removeSlot(day, idx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}

            <div className="mt-1 h-px bg-border/40" />
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const { data: session, status: authStatus } = useSession()

  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS)
  const [yearlyRules, setYearlyRules] = useState<IWeeklyRule[]>([])
  const [exceptions, setExceptions] = useState<IDateException[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Calendar navigation
  const today = new Date()
  const todayStr = formatDateStr(today)
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState("")

  // New rule form
  const [showNewRule, setShowNewRule] = useState(false)
  const [newRule, setNewRule] = useState<IWeeklyRule>({
    name: "", startWeek: 1, endWeek: 52, slots: { ...EMPTY_WEEKLY_SLOTS },
  })

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return
    Promise.all([
      fetch(`/api/availability?takumiId=${session.user.id}&full=true`).then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
    ])
      .then(([availData, bookingsData]) => {
        setSlots(availData.slots || EMPTY_SLOTS)
        setYearlyRules(availData.yearlyRules || [])
        setExceptions(availData.exceptions || [])
        setBookings(
          (bookingsData.bookings || []).filter(
            (b: Booking) => !["cancelled", "declined"].includes(b.status)
          )
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, yearlyRules, exceptions }),
      })
      const data = await res.json()
      if (res.ok) toast.success(data.message || "Verfügbarkeit gespeichert!")
      else toast.error(data.error)
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setSaving(false)
    }
  }

  // ── Booking action ────────────────────────────────────────────────────────
  async function handleBookingAction(
    bookingId: string,
    token: string,
    action: "confirmed" | "declined"
  ) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(action === "confirmed" ? "Buchung bestätigt!" : "Buchung abgelehnt.")
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: action } : b))
        )
      } else toast.error(data.error)
    } catch {
      toast.error("Netzwerkfehler.")
    }
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────

  // Availability data merged object for resolveSlots
  const availData: IAvailabilityData = useMemo(
    () => ({
      slots: slots as unknown as WeeklySlots,
      yearlyRules,
      exceptions,
    }),
    [slots, yearlyRules, exceptions]
  )

  // Calendar days for current view month (week starts Monday)
  const calendarDays = useMemo(() => {
    let firstDay = new Date(viewYear, viewMonth, 1).getDay()
    firstDay = (firstDay + 6) % 7 // Mon=0 ... Sun=6
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days: (number | null)[] = Array(firstDay).fill(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }, [viewMonth, viewYear])

  function getDayInfo(day: number) {
    const dateStr = formatDateStr(new Date(viewYear, viewMonth, day))
    const isPast    = dateStr < todayStr
    const isToday   = dateStr === todayStr
    const exception = exceptions.find((e) => e.date === dateStr)
    const resolved  = resolveSlots(availData, dateStr)
    const dayBookings = bookings.filter((b) => b.date === dateStr)
    return { dateStr, isPast, isToday, exception, resolved, dayBookings }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  // ── Selected date detail ──────────────────────────────────────────────────
  const selectedInfo = useMemo(() => {
    if (!selectedDate) return null
    const exception   = exceptions.find((e) => e.date === selectedDate)
    const resolved    = resolveSlots(availData, selectedDate)
    const dayBookings = bookings.filter((b) => b.date === selectedDate)
    const d    = new Date(selectedDate + "T00:00:00")
    const week = getISOWeek(d)
    const year = d.getFullYear()

    let source: "exception" | "rule" | "default" = "default"
    if (exception) {
      source = "exception"
    } else {
      const hasRule = yearlyRules.find(
        (r) =>
          (r.year === year || !r.year) &&
          week >= r.startWeek &&
          week <= r.endWeek
      )
      if (hasRule) source = "rule"
    }
    return { exception, resolved, dayBookings, source }
  }, [selectedDate, availData, bookings, exceptions, yearlyRules])

  function addException(type: "unavailable" | "custom") {
    if (!selectedDate) return
    if (exceptions.find((e) => e.date === selectedDate)) {
      toast.error("Für diesen Tag gibt es bereits eine Ausnahme.")
      return
    }
    const base: IDateException = {
      date:   selectedDate,
      reason: type === "unavailable" ? "Nicht verfügbar" : "Sonderöffnung",
      type,
      slots:  type === "custom"
        ? (selectedInfo?.resolved.length ? selectedInfo.resolved : [{ start: "09:00", end: "17:00" }])
        : [],
    }
    setExceptions((prev) => [...prev, base])
    toast.success("Ausnahme hinzugefügt — vergiss nicht zu speichern!")
  }

  function removeException(date: string) {
    setExceptions((prev) => prev.filter((e) => e.date !== date))
  }

  function updateException(date: string, patch: Partial<IDateException>) {
    setExceptions((prev) => prev.map((e) => (e.date === date ? { ...e, ...patch } : e)))
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  const pendingBookings  = bookings.filter((b) => b.status === "pending")
  const upcomingConfirmed = bookings
    .filter((b) => b.status === "confirmed" && b.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-28">
      <PageContainer>
        <div className="flex flex-col gap-5">

          {/* Header */}
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link href="/profile"><ArrowLeft className="size-5" /></Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Arbeitszeiten verwalten</h1>
              <p className="text-xs text-muted-foreground">
                Verfügbarkeit · Regeln · Buchungskalender
              </p>
            </div>
          </div>

          {/* Pending bookings alert */}
          {pendingBookings.length > 0 && (
            <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-400">
                  <AlertCircle className="size-4" />
                  {pendingBookings.length} offene Buchungsanfrage{pendingBookings.length > 1 ? "n" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {pendingBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-card p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{b.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDisplay(b.date)} · {b.startTime}–{b.endTime}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleBookingAction(b.id, b.statusToken, "confirmed")}
                      >
                        <CheckCircle className="size-3" /> Annehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs border-destructive/30 text-destructive"
                        onClick={() => handleBookingAction(b.id, b.statusToken, "declined")}
                      >
                        <XCircle className="size-3" /> Ablehnen
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="schedule" className="gap-1 text-xs">
                <Clock className="size-3" /> Wochenplan
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1 text-xs">
                <Calendar className="size-3" /> Kalender
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-1 text-xs">
                <CalendarDays className="size-3" /> Regeln
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Standard Weekly Schedule ─────────────────────────── */}
            <TabsContent value="schedule">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-primary" />
                    Standard-Wochenplan
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Gilt für alle Wochen ohne spezielle Regel. Zeiten in 15-Minuten-Intervallen.
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <WeeklySlotsEditor slots={slots} onChange={setSlots} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Month Calendar + Day Detail ──────────────────────── */}
            <TabsContent value="calendar">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">

                {/* Calendar grid */}
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-primary" />
                        Kalenderübersicht
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-7" onClick={prevMonth}>
                          <ChevronLeft className="size-4" />
                        </Button>
                        <span className="min-w-[130px] text-center text-xs font-semibold">
                          {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        <Button variant="ghost" size="icon" className="size-7" onClick={nextMonth}>
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Day headers — week starts Monday */}
                    <div className="mb-1 grid grid-cols-7 gap-1 text-center">
                      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                        <span key={d} className="py-1 text-[10px] font-medium text-muted-foreground">
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, i) => {
                        if (day === null) return <div key={`e-${i}`} className="size-10" />
                        const { dateStr, isPast, isToday, exception, resolved, dayBookings } = getDayInfo(day)
                        const isSelected  = dateStr === selectedDate
                        const isAvailable = resolved.length > 0

                        return (
                          <button
                            key={day}
                            onClick={() => !isPast && setSelectedDate(dateStr === selectedDate ? "" : dateStr)}
                            disabled={isPast}
                            className={[
                              "relative flex flex-col items-center justify-center size-10 rounded-xl text-xs font-medium transition-all",
                              isSelected  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40" : "",
                              isToday && !isSelected ? "ring-2 ring-primary/40 font-bold text-primary" : "",
                              !isSelected && !isPast ? "hover:bg-muted cursor-pointer" : "",
                              isPast ? "cursor-default text-muted-foreground/25" : "text-foreground",
                            ].join(" ")}
                          >
                            <span>{day}</span>

                            {/* Status dot */}
                            {!isPast && (
                              <span
                                className={[
                                  "absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full",
                                  exception?.type === "unavailable" ? "bg-destructive"  : "",
                                  exception?.type === "custom"      ? "bg-amber-500"    : "",
                                  !exception && isAvailable          ? "bg-green-500"   : "",
                                ].join(" ")}
                              />
                            )}

                            {/* Booking count badge */}
                            {!isSelected && dayBookings.length > 0 && (
                              <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-accent text-[7px] font-bold text-accent-foreground">
                                {dayBookings.length}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-green-500" /> Verfügbar
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-destructive" /> Nicht verfügbar
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-amber-500" /> Sonderzeit
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-accent" /> Buchung
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Day detail panel */}
                {selectedDate && selectedInfo ? (
                  <Card className="lg:w-72">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <span>
                          {DAY_NAMES[new Date(selectedDate + "T00:00:00").getDay()]},{" "}
                          {formatDisplay(selectedDate)}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          KW {getISOWeek(new Date(selectedDate + "T00:00:00"))}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">

                      {/* Availability status */}
                      <div
                        className={[
                          "flex items-start gap-2 rounded-lg p-2.5 text-xs",
                          selectedInfo.exception?.type === "unavailable"
                            ? "bg-destructive/10 text-destructive"
                            : selectedInfo.exception?.type === "custom"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : selectedInfo.resolved.length > 0
                                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        <Info className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {selectedInfo.exception?.type === "unavailable"
                            ? `Nicht verfügbar: ${selectedInfo.exception.reason}`
                            : selectedInfo.exception?.type === "custom"
                              ? `Sonderzeit: ${selectedInfo.exception.reason}`
                              : selectedInfo.source === "rule"
                                ? "Überschrieben durch Saison-Regel"
                                : selectedInfo.resolved.length > 0
                                  ? "Aus Standard-Wochenplan"
                                  : "Kein Standardplan für diesen Wochentag"}
                        </span>
                      </div>

                      {/* Resolved time slots */}
                      {selectedInfo.resolved.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Verfügbare Zeiten
                          </p>
                          {(selectedInfo.exception?.type === "custom"
                            ? selectedInfo.exception.slots || []
                            : selectedInfo.resolved
                          ).map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              <Clock className="size-3 text-primary" />
                              <span>{s.start} – {s.end}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bookings on this day */}
                      {selectedInfo.dayBookings.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Buchungen ({selectedInfo.dayBookings.length})
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {selectedInfo.dayBookings.map((b) => (
                              <div
                                key={b.id}
                                className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="truncate text-[11px] font-medium">{b.userName}</p>
                                  <p className="text-[10px] text-muted-foreground">{b.startTime}–{b.endTime}</p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-[9px] ${
                                    b.status === "confirmed"
                                      ? "border-green-500/30 bg-green-500/10 text-green-600"
                                      : b.status === "pending"
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                                        : "border-border bg-muted"
                                  }`}
                                >
                                  {b.status === "confirmed" ? "Bestätigt" : b.status === "pending" ? "Anfrage" : b.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exception actions */}
                      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Ausnahme für diesen Tag
                        </p>

                        {selectedInfo.exception ? (
                          <div className="flex flex-col gap-2">
                            {/* Edit custom slots inline */}
                            {selectedInfo.exception.type === "custom" && (
                              <div className="flex flex-col gap-1.5">
                                {(selectedInfo.exception.slots || []).map((slot, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <input
                                      type="time"
                                      step="900"
                                      value={slot.start}
                                      onChange={(e) => {
                                        const s = [...(selectedInfo.exception!.slots || [])]
                                        s[idx] = { ...slot, start: e.target.value }
                                        updateException(selectedDate, { slots: s })
                                      }}
                                      className="h-7 w-24 rounded-md border border-input bg-background px-1.5 text-[11px]"
                                    />
                                    <span className="text-[10px]">–</span>
                                    <input
                                      type="time"
                                      step="900"
                                      value={slot.end}
                                      onChange={(e) => {
                                        const s = [...(selectedInfo.exception!.slots || [])]
                                        s[idx] = { ...slot, end: e.target.value }
                                        updateException(selectedDate, { slots: s })
                                      }}
                                      className="h-7 w-24 rounded-md border border-input bg-background px-1.5 text-[11px]"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-6"
                                      onClick={() => {
                                        const s = (selectedInfo.exception!.slots || []).filter((_, i) => i !== idx)
                                        updateException(selectedDate, { slots: s })
                                      }}
                                    >
                                      <Trash2 className="size-3 text-destructive/60" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-primary"
                                  onClick={() => {
                                    const s = [...(selectedInfo.exception!.slots || []), { start: "09:00", end: "17:00" }]
                                    updateException(selectedDate, { slots: s })
                                  }}
                                >
                                  <Plus className="size-3 mr-1" /> Zeitblock
                                </Button>
                              </div>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-8 text-xs border-destructive/30 text-destructive"
                              onClick={() => removeException(selectedDate)}
                            >
                              <Trash2 className="size-3 mr-1" /> Ausnahme entfernen
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full text-xs border-destructive/30 text-destructive"
                              onClick={() => addException("unavailable")}
                            >
                              <CalendarX2 className="size-3 mr-1" /> Nicht verfügbar markieren
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full text-xs border-amber-500/40 text-amber-700 dark:text-amber-400"
                              onClick={() => addException("custom")}
                            >
                              <Plus className="size-3 mr-1" /> Sonderzeiten festlegen
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="hidden lg:flex lg:w-72 items-center justify-center rounded-xl border border-dashed border-border/60 p-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Calendar className="size-8 opacity-30" />
                      <p className="text-xs">Tag auswählen um Details zu sehen</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Seasonal Rules ────────────────────────────────────── */}
            <TabsContent value="rules">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CalendarDays className="size-4 text-primary" />
                    Saisonale Regeln
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Überschreibe den Wochenplan für bestimmte Kalenderwochen (z.B. Sommerferien, Nebensaison).
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {yearlyRules.length === 0 && !showNewRule && (
                    <p className="py-4 text-center text-xs italic text-muted-foreground">
                      Keine saisonalen Regeln definiert
                    </p>
                  )}

                  {yearlyRules.map((rule, idx) => (
                    <div key={idx} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{rule.name}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            KW {rule.startWeek}–{rule.endWeek}
                            {rule.year ? ` (${rule.year})` : ""}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-destructive/60 hover:text-destructive"
                          onClick={() => setYearlyRules(yearlyRules.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <WeeklySlotsEditor
                        slots={rule.slots as unknown as Slots}
                        onChange={(newSlots) => {
                          const updated = [...yearlyRules]
                          updated[idx] = { ...rule, slots: newSlots as unknown as WeeklySlots }
                          setYearlyRules(updated)
                        }}
                      />
                    </div>
                  ))}

                  {showNewRule ? (
                    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3">
                      <h4 className="mb-3 text-xs font-semibold">Neue Regel erstellen</h4>
                      <div className="flex flex-col gap-2.5">
                        <Input
                          placeholder="Name (z.B. Sommerferien, Nebensaison)"
                          value={newRule.name}
                          onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                          className="h-8 text-xs"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">KW</span>
                          <Input
                            type="number" min={1} max={53}
                            value={newRule.startWeek}
                            onChange={(e) => setNewRule({ ...newRule, startWeek: Number(e.target.value) })}
                            className="h-8 w-16 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">bis KW</span>
                          <Input
                            type="number" min={1} max={53}
                            value={newRule.endWeek}
                            onChange={(e) => setNewRule({ ...newRule, endWeek: Number(e.target.value) })}
                            className="h-8 w-16 text-xs"
                          />
                          <Input
                            type="number" min={2024} max={2050}
                            placeholder="Jahr (opt.)"
                            value={newRule.year ?? ""}
                            onChange={(e) =>
                              setNewRule({
                                ...newRule,
                                year: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className="h-8 w-28 text-xs"
                          />
                        </div>
                        <WeeklySlotsEditor
                          slots={newRule.slots as unknown as Slots}
                          onChange={(s) => setNewRule({ ...newRule, slots: s as unknown as WeeklySlots })}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 flex-1 text-xs"
                            onClick={() => {
                              if (!newRule.name) { toast.error("Bitte Namen eingeben."); return }
                              setYearlyRules([...yearlyRules, { ...newRule }])
                              setNewRule({ name: "", startWeek: 1, endWeek: 52, slots: { ...EMPTY_WEEKLY_SLOTS } })
                              setShowNewRule(false)
                              toast.success("Regel hinzugefügt!")
                            }}
                          >
                            <Plus className="mr-1 size-3" /> Hinzufügen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setShowNewRule(false)}
                          >
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-dashed"
                      onClick={() => setShowNewRule(true)}
                    >
                      <Plus className="size-4" /> Neue Regel erstellen
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Upcoming confirmed bookings */}
          {upcomingConfirmed.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-primary" />
                  Nächste bestätigte Termine
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {upcomingConfirmed.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium">{b.userName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDisplay(b.date)} · {b.startTime}–{b.endTime}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/5 text-primary">
                      Bestätigt
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2 rounded-xl bg-primary font-semibold shadow-md shadow-primary/20"
          >
            {saving ? (
              <><Loader2 className="size-4 animate-spin" /> Wird gespeichert...</>
            ) : (
              <><Save className="size-4" /> Alle Änderungen speichern</>
            )}
          </Button>

        </div>
      </PageContainer>
    </div>
  )
}

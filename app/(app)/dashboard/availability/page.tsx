"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageContainer } from "@/components/page-container"
import { toast } from "sonner"
import {
  ArrowLeft, Plus, Trash2, Loader2, Save, Clock, Calendar,
  CheckCircle, XCircle, AlertCircle, CalendarDays, CalendarX2, ChevronLeft, ChevronRight,
} from "lucide-react"

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
const MONTH_NAMES = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]

interface TimeSlot { start: string; end: string }
type Slots = Record<number, TimeSlot[]>

interface WeeklyRule {
  name: string
  startWeek: number
  endWeek: number
  year?: number
  slots: Slots
}

interface DateException {
  date: string
  reason: string
  type: "unavailable" | "custom"
  slots?: TimeSlot[]
}

interface Booking {
  _id: string
  userName: string
  date: string
  startTime: string
  endTime: string
  status: "pending" | "confirmed" | "declined" | "cancelled" | "active" | "completed"
  statusToken: string
}

const EMPTY_SLOTS: Slots = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Weekly slots editor component
function WeeklySlotsEditor({
  slots,
  onChange,
  compact = false,
}: {
  slots: Slots
  onChange: (slots: Slots) => void
  compact?: boolean
}) {
  const handleAddSlot = (day: number) => {
    onChange({
      ...slots,
      [day]: [...(slots[day] || []), { start: "09:00", end: "12:00" }],
    })
  }

  const handleRemoveSlot = (day: number, idx: number) => {
    onChange({
      ...slots,
      [day]: slots[day].filter((_, i) => i !== idx),
    })
  }

  const handleSlotChange = (day: number, idx: number, field: "start" | "end", value: string) => {
    onChange({
      ...slots,
      [day]: slots[day].map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    })
  }

  const days = compact ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 0] // Mo-Fr for compact, all for full

  return (
    <div className="flex flex-col gap-3">
      {days.map((day) => (
        <div key={day} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className={`font-medium text-foreground ${compact ? "text-xs" : "text-sm"}`}>
              <span className="inline-block w-5 text-muted-foreground">{DAY_SHORT[day]}</span>{" "}
              {compact ? "" : DAY_NAMES[day]}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 text-[10px] text-primary"
              onClick={() => handleAddSlot(day)}
            >
              <Plus className="size-2.5" /> Slot
            </Button>
          </div>

          {(slots[day] || []).length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic pl-5">Nicht verfuegbar</p>
          ) : (
            (slots[day] || []).map((slot, idx) => (
              <div key={idx} className="flex items-center gap-1.5 pl-5">
                <Input
                  type="time"
                  value={slot.start}
                  onChange={(e) => handleSlotChange(day, idx, "start", e.target.value)}
                  className="h-7 w-24 text-[11px]"
                />
                <span className="text-[10px] text-muted-foreground">-</span>
                <Input
                  type="time"
                  value={slot.end}
                  onChange={(e) => handleSlotChange(day, idx, "end", e.target.value)}
                  className="h-7 w-24 text-[11px]"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 text-destructive/60 hover:text-destructive"
                  onClick={() => handleRemoveSlot(day, idx)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  )
}

export default function AvailabilityPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS)
  const [yearlyRules, setYearlyRules] = useState<WeeklyRule[]>([])
  const [exceptions, setExceptions] = useState<DateException[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Bookings for this takumi
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)

  // Calendar view state
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedDates, setSelectedDates] = useState<string[]>([]) // Multi-select for bulk operations

  // New rule form
  const [newRule, setNewRule] = useState<WeeklyRule>({
    name: "",
    startWeek: 1,
    endWeek: 52,
    slots: { ...EMPTY_SLOTS },
  })
  const [showNewRule, setShowNewRule] = useState(false)

  // Load availability
  useEffect(() => {
    if (!session?.user?.id) return
    fetch(`/api/availability?takumiId=${session.user.id}&full=true`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || EMPTY_SLOTS)
        setYearlyRules(data.yearlyRules || [])
        setExceptions(data.exceptions || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  // Load bookings
  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setBookings((data.bookings || []).filter((b: Booking) => b.status !== "cancelled")))
      .catch(() => {})
      .finally(() => setLoadingBookings(false))
  }, [session])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, yearlyRules, exceptions }),
      })
      const data = await res.json()
      if (res.ok) toast.success(data.message)
      else toast.error(data.error)
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setSaving(false)
    }
  }

  async function handleBookingAction(bookingId: string, token: string, action: "confirmed" | "declined") {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(action === "confirmed" ? "Buchung bestaetigt!" : "Buchung abgelehnt.")
        setBookings((prev) => prev.map((b) => b._id === bookingId ? { ...b, status: action } : b))
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error("Netzwerkfehler.")
    }
  }

  function handleAddRule() {
    if (!newRule.name) {
      toast.error("Bitte gib einen Namen fuer die Regel ein.")
      return
    }
    setYearlyRules([...yearlyRules, { ...newRule }])
    setNewRule({ name: "", startWeek: 1, endWeek: 52, slots: { ...EMPTY_SLOTS } })
    setShowNewRule(false)
    toast.success("Regel hinzugefuegt. Vergiss nicht zu speichern!")
  }

  function handleRemoveRule(idx: number) {
    setYearlyRules(yearlyRules.filter((_, i) => i !== idx))
    toast.info("Regel entfernt. Vergiss nicht zu speichern!")
  }

  function handleAddException(type: "unavailable" | "custom") {
    const datesToAdd = selectedDates.length > 0 ? selectedDates : selectedDate ? [selectedDate] : []
    if (datesToAdd.length === 0) {
      toast.error("Bitte waehle zuerst ein oder mehrere Daten im Kalender.")
      return
    }
    const newExceptions: DateException[] = []
    for (const date of datesToAdd) {
      const existing = exceptions.find((e) => e.date === date)
      if (!existing) {
        newExceptions.push({
          date,
          reason: type === "unavailable" ? "Nicht verfuegbar" : "Sonderoeffnung",
          type,
          slots: type === "custom" ? [{ start: "09:00", end: "17:00" }] : [],
        })
      }
    }
    if (newExceptions.length === 0) {
      toast.error("Alle ausgewaehlten Daten haben bereits Ausnahmen.")
      return
    }
    setExceptions([...exceptions, ...newExceptions])
    setSelectedDates([])
    setSelectedDate("")
    toast.success(`${newExceptions.length} Ausnahme(n) hinzugefuegt. Vergiss nicht zu speichern!`)
  }

  function toggleDateSelection(dateStr: string) {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    )
  }

  function selectWeekRange(startWeek: number, endWeek: number) {
    const dates: string[] = []
    const startDate = new Date(viewYear, 0, 1)
    // Find first Monday of year
    while (startDate.getDay() !== 1) startDate.setDate(startDate.getDate() + 1)
    // Move to start week
    startDate.setDate(startDate.getDate() + (startWeek - 1) * 7)
    // Add all days until end week
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + (endWeek - startWeek + 1) * 7 - 1)
    const current = new Date(startDate)
    while (current <= endDate && current.getFullYear() === viewYear) {
      dates.push(formatDateStr(current))
      current.setDate(current.getDate() + 1)
    }
    setSelectedDates(dates)
    toast.info(`${dates.length} Tage ausgewaehlt (KW ${startWeek}-${endWeek})`)
  }

  function handleRemoveException(date: string) {
    setExceptions(exceptions.filter((e) => e.date !== date))
    toast.info("Ausnahme entfernt. Vergiss nicht zu speichern!")
  }

  function handleExceptionChange(date: string, update: Partial<DateException>) {
    setExceptions(exceptions.map((e) => e.date === date ? { ...e, ...update } : e))
  }

  // Generate calendar data for a specific month
  function getMonthDays(month: number, year: number): (number | null)[] {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (number | null)[] = Array(firstDay).fill(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending")
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed")

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageContainer>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link href="/profile"><ArrowLeft className="size-5" /></Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Arbeitszeiten verwalten</h1>
              <p className="text-xs text-muted-foreground">
                Standard-Zeiten, Saisonregeln und Ausnahmen
              </p>
            </div>
          </div>

          {/* Pending Bookings Alert */}
          {pendingBookings.length > 0 && (
            <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertCircle className="size-4 text-amber-600" />
                  {pendingBookings.length} offene Anfrage{pendingBookings.length > 1 ? "n" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {pendingBookings.map((b) => (
                  <div key={b._id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-card p-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{b.userName}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.date} / {b.startTime} - {b.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 gap-1 bg-primary text-xs font-semibold text-primary-foreground"
                        onClick={() => handleBookingAction(b._id, b.statusToken, "confirmed")}
                      >
                        <CheckCircle className="size-3" /> Annehmen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 border-destructive/30 text-xs font-semibold text-destructive"
                        onClick={() => handleBookingAction(b._id, b.statusToken, "declined")}
                      >
                        <XCircle className="size-3" /> Ablehnen
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Confirmed Bookings */}
          {confirmedBookings.length > 0 && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-primary" />
                  Bestaetigte Termine ({confirmedBookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {confirmedBookings.slice(0, 5).map((b) => (
                  <div key={b._id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">{b.userName}</span>
                      <span className="text-[11px] text-muted-foreground">{b.date} / {b.startTime}-{b.endTime}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/5 text-primary">
                      Bestaetigt
                    </Badge>
                  </div>
                ))}
                {confirmedBookings.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+ {confirmedBookings.length - 5} weitere</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabs for different settings */}
          <Tabs defaultValue="default" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="default" className="text-xs gap-1">
                <Clock className="size-3" /> Standard
              </TabsTrigger>
              <TabsTrigger value="rules" className="text-xs gap-1">
                <CalendarDays className="size-3" /> Regeln
              </TabsTrigger>
              <TabsTrigger value="exceptions" className="text-xs gap-1">
                <CalendarX2 className="size-3" /> Ausnahmen
              </TabsTrigger>
            </TabsList>

            {/* Default Weekly Schedule */}
            <TabsContent value="default">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-primary" />
                    Standard-Wochenplan
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Gilt fuer alle Wochen ohne spezielle Regel
                  </p>
                </CardHeader>
                <CardContent>
                  <WeeklySlotsEditor slots={slots} onChange={setSlots} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Yearly Rules */}
            <TabsContent value="rules">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CalendarDays className="size-4 text-primary" />
                    Saisonale Regeln
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Definiere unterschiedliche Zeiten fuer bestimmte Kalenderwochen
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {yearlyRules.length === 0 && !showNewRule && (
                    <p className="text-xs text-muted-foreground italic text-center py-4">
                      Keine saisonalen Regeln definiert
                    </p>
                  )}

                  {yearlyRules.map((rule, idx) => (
                    <div key={idx} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{rule.name}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            KW {rule.startWeek} - {rule.endWeek}
                            {rule.year && ` (${rule.year})`}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-destructive/60 hover:text-destructive"
                          onClick={() => handleRemoveRule(idx)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <WeeklySlotsEditor
                        slots={rule.slots}
                        onChange={(newSlots) => {
                          const updated = [...yearlyRules]
                          updated[idx] = { ...rule, slots: newSlots }
                          setYearlyRules(updated)
                        }}
                        compact
                      />
                    </div>
                  ))}

                  {showNewRule ? (
                    <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3">
                      <h4 className="text-xs font-semibold text-foreground mb-3">Neue Regel erstellen</h4>
                      <div className="flex flex-col gap-3">
                        <Input
                          placeholder="Name (z.B. Sommerferien, Nebensaison)"
                          value={newRule.name}
                          onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                          className="h-8 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">KW</span>
                          <Input
                            type="number"
                            min={1}
                            max={53}
                            value={newRule.startWeek}
                            onChange={(e) => setNewRule({ ...newRule, startWeek: Number(e.target.value) })}
                            className="h-8 w-16 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">bis</span>
                          <Input
                            type="number"
                            min={1}
                            max={53}
                            value={newRule.endWeek}
                            onChange={(e) => setNewRule({ ...newRule, endWeek: Number(e.target.value) })}
                            className="h-8 w-16 text-xs"
                          />
                        </div>
                        <WeeklySlotsEditor
                          slots={newRule.slots}
                          onChange={(s) => setNewRule({ ...newRule, slots: s })}
                          compact
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleAddRule} className="flex-1 h-8 text-xs">
                            <Plus className="size-3 mr-1" /> Regel hinzufuegen
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowNewRule(false)} className="h-8 text-xs">
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full border-dashed gap-2"
                      onClick={() => setShowNewRule(true)}
                    >
                      <Plus className="size-4" /> Neue Regel erstellen
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Date Exceptions - Full Year Calendar */}
            <TabsContent value="exceptions">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CalendarX2 className="size-4 text-primary" />
                      Jahreskalender {viewYear}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setViewYear(viewYear - 1)}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setViewYear(viewYear + 1)}>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Klicke auf Tage um Ausnahmen zu markieren. Halte Shift fuer Mehrfachauswahl.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {/* Quick week range selection */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => selectWeekRange(1, 52)}>
                      Ganzes Jahr
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => selectWeekRange(1, 13)}>
                      Q1 (KW 1-13)
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => selectWeekRange(14, 26)}>
                      Q2 (KW 14-26)
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => selectWeekRange(27, 39)}>
                      Q3 (KW 27-39)
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => selectWeekRange(40, 52)}>
                      Q4 (KW 40-52)
                    </Button>
                    {selectedDates.length > 0 && (
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => setSelectedDates([])}>
                        Auswahl loeschen ({selectedDates.length})
                      </Button>
                    )}
                  </div>

                  {/* Full Year Calendar - 12 months grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {MONTH_NAMES.map((monthName, monthIdx) => {
                      const days = getMonthDays(monthIdx, viewYear)
                      return (
                        <div key={monthIdx} className="rounded-lg border border-border/40 bg-muted/10 p-2">
                          <p className="text-[10px] font-semibold text-foreground mb-1.5 text-center">{monthName}</p>
                          <div className="grid grid-cols-7 gap-px text-center mb-0.5">
                            {["S", "M", "D", "M", "D", "F", "S"].map((d, i) => (
                              <span key={i} className="text-[7px] font-medium text-muted-foreground">{d}</span>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-px">
                            {days.map((day, i) => {
                              if (day === null) return <div key={`e-${monthIdx}-${i}`} className="size-5" />
                              const dateStr = formatDateStr(new Date(viewYear, monthIdx, day))
                              const exception = exceptions.find((e) => e.date === dateStr)
                              const isSelected = selectedDates.includes(dateStr) || dateStr === selectedDate
                              const isPast = new Date(dateStr) < new Date(formatDateStr(today))
                              const isToday = dateStr === formatDateStr(today)
                              return (
                                <button
                                  key={day}
                                  onClick={(e) => {
                                    if (isPast) return
                                    if (e.shiftKey) {
                                      toggleDateSelection(dateStr)
                                    } else {
                                      setSelectedDate(dateStr)
                                      setSelectedDates([])
                                    }
                                  }}
                                  disabled={isPast}
                                  className={`flex size-5 items-center justify-center rounded-sm text-[8px] font-medium transition-colors
                                    ${isSelected ? "bg-primary text-primary-foreground ring-1 ring-primary" : ""}
                                    ${!isSelected && exception?.type === "unavailable" ? "bg-destructive/30 text-destructive" : ""}
                                    ${!isSelected && exception?.type === "custom" ? "bg-accent/30 text-accent" : ""}
                                    ${!isSelected && !exception && !isPast ? "hover:bg-muted" : ""}
                                    ${isPast ? "text-muted-foreground/20" : "text-foreground"}
                                    ${isToday && !isSelected ? "ring-1 ring-primary/50" : ""}
                                  `}
                                >
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Action bar for selected dates */}
                  {(selectedDate || selectedDates.length > 0) && (
                    <div className="sticky bottom-0 rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="text-xs font-medium text-foreground mb-2">
                        {selectedDates.length > 0
                          ? `${selectedDates.length} Tage ausgewaehlt`
                          : `${selectedDate.split("-").reverse().join(".")} (KW ${getISOWeek(new Date(selectedDate))})`}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs border-destructive/30 text-destructive"
                          onClick={() => handleAddException("unavailable")}
                        >
                          <CalendarX2 className="size-3 mr-1" /> Nicht verfuegbar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs border-accent/30 text-accent"
                          onClick={() => handleAddException("custom")}
                        >
                          <Plus className="size-3 mr-1" /> Sonderzeit
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Exceptions List */}
                  {exceptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-2">
                      Keine Ausnahmen definiert
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {exceptions
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((ex) => (
                          <div
                            key={ex.date}
                            className={`rounded-lg border p-3 ${
                              ex.type === "unavailable"
                                ? "border-destructive/30 bg-destructive/5"
                                : "border-accent/30 bg-accent/5"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {ex.date.split("-").reverse().join(".")}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] ${
                                    ex.type === "unavailable"
                                      ? "border-destructive/30 text-destructive"
                                      : "border-accent/30 text-accent"
                                  }`}
                                >
                                  {ex.type === "unavailable" ? "Geschlossen" : "Sonderzeit"}
                                </Badge>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-destructive/60 hover:text-destructive"
                                onClick={() => handleRemoveException(ex.date)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                            <Input
                              value={ex.reason}
                              onChange={(e) => handleExceptionChange(ex.date, { reason: e.target.value })}
                              placeholder="Grund (z.B. Urlaub, Feiertag)"
                              className="h-7 text-[11px] mb-2"
                            />
                            {ex.type === "custom" && (
                              <div className="flex flex-col gap-1">
                                {(ex.slots || []).map((slot, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <Input
                                      type="time"
                                      value={slot.start}
                                      onChange={(e) => {
                                        const newSlots = [...(ex.slots || [])]
                                        newSlots[idx] = { ...slot, start: e.target.value }
                                        handleExceptionChange(ex.date, { slots: newSlots })
                                      }}
                                      className="h-6 w-20 text-[10px]"
                                    />
                                    <span className="text-[9px] text-muted-foreground">-</span>
                                    <Input
                                      type="time"
                                      value={slot.end}
                                      onChange={(e) => {
                                        const newSlots = [...(ex.slots || [])]
                                        newSlots[idx] = { ...slot, end: e.target.value }
                                        handleExceptionChange(ex.date, { slots: newSlots })
                                      }}
                                      className="h-6 w-20 text-[10px]"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-5"
                                      onClick={() => {
                                        const newSlots = (ex.slots || []).filter((_, i) => i !== idx)
                                        handleExceptionChange(ex.date, { slots: newSlots })
                                      }}
                                    >
                                      <Trash2 className="size-2.5 text-destructive/60" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] text-primary"
                                  onClick={() => {
                                    const newSlots = [...(ex.slots || []), { start: "09:00", end: "17:00" }]
                                    handleExceptionChange(ex.date, { slots: newSlots })
                                  }}
                                >
                                  <Plus className="size-2.5 mr-1" /> Zeitslot
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20"
          >
            {saving ? (
              <><Loader2 className="size-4 animate-spin" /> Wird gespeichert...</>
            ) : (
              <><Save className="size-4" /> Alle Aenderungen speichern</>
            )}
          </Button>
        </div>
      </PageContainer>
    </div>
  )
}

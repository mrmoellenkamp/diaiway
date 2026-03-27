"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { PageContainer } from "@/components/page-container"
import { AppSubpageHeader } from "@/components/app-subpage-header"
import { toast } from "sonner"
import {
  Plus, Trash2, Loader2, Save, Clock, Calendar,
  CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  CalendarX2, CalendarDays, Info, Phone, UserPlus, Copy, Check, Link2,
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
import { BookingCalendar } from "@/components/booking-calendar"
import { useI18n } from "@/lib/i18n"

// ─── Constants ─────────────────────────────────────────────────────────────

const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0]

type Slots = Record<number, ITimeSlot[]>
const EMPTY_SLOTS: Slots = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

interface Booking {
  id: string
  userId?: string
  userName: string
  date: string
  startTime: string
  endTime: string
  status: "pending" | "confirmed" | "declined" | "cancelled" | "active" | "completed"
  statusToken: string
}

interface GuestBooking {
  id: string
  guestToken: string
  guestEmail: string
  date: string
  startTime: string
  endTime: string
  totalPrice: number
  paymentStatus: "unpaid" | "paid" | "refunded"
  status: string
  createdAt: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  return `${d}.${m}.${y}`
}

function bookingDateTimeKey(b: Pick<Booking, "date" | "startTime">): string {
  return `${b.date}T${b.startTime || "00:00"}`
}

function compareBookingDateTimeAsc(a: Pick<Booking, "date" | "startTime">, b: Pick<Booking, "date" | "startTime">): number {
  return bookingDateTimeKey(a).localeCompare(bookingDateTimeKey(b))
}

// ─── WeeklySlotsEditor — 15-min interval time inputs ──────────────────────

function WeeklySlotsEditor({
  slots,
  onChange,
}: {
  slots: Slots
  onChange: (s: Slots) => void
}) {
  const { t, locale } = useI18n()

  const DAY_NAMES = locale === "en"
    ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    : locale === "es"
      ? ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
      : ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]

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
                  <Plus className="size-3" /> {t("avail.timeBlock")}
                </Button>
              ) : (
                <span className="text-xs italic text-muted-foreground">{t("avail.notAvailable")}</span>
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useI18n()
  const userRole = (session?.user as { role?: string })?.role
  const appRole = (session?.user as { appRole?: string })?.appRole
  useEffect(() => {
    if (authStatus === "authenticated" && appRole !== "takumi" && userRole !== "admin") {
      router.replace("/home")
    }
  }, [authStatus, appRole, userRole, router])

  const DAY_NAMES = locale === "en"
    ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    : locale === "es"
      ? ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
      : ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]

  const DAY_SHORT_HEADER = locale === "en"
    ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
    : locale === "es"
      ? ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"]
      : ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

  const MONTH_NAMES = locale === "en"
    ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    : locale === "es"
      ? ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
      : ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]

  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS)
  const [yearlyRules, setYearlyRules] = useState<IWeeklyRule[]>([])
  const [exceptions, setExceptions] = useState<IDateException[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Guest invite state
  const [guestBookings, setGuestBookings] = useState<GuestBooking[]>([])
  const [guestForm, setGuestForm] = useState({
    guestEmail: "", date: "", startTime: "10:00", endTime: "11:00",
    callType: "VIDEO", totalPrice: "", note: "", hostMessage: "",
  })
  const [guestCreating, setGuestCreating] = useState(false)
  const [guestLink, setGuestLink] = useState<string | null>(null)
  const [guestCopied, setGuestCopied] = useState(false)
  const [guestCancelling, setGuestCancelling] = useState<string | null>(null)
  // Takumi price per 15 min for auto-calculation
  const [priceVideo15, setPriceVideo15] = useState<number>(0)

  // Calendar navigation
  const today = new Date()
  const todayStr = formatDateStr(today)
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState("")

  // New rule form
  const [instantSlots, setInstantSlots] = useState<Slots>(EMPTY_SLOTS)
  const [showNewRule, setShowNewRule] = useState(false)
  const [newRule, setNewRule] = useState<IWeeklyRule>({
    name: "", startWeek: 1, endWeek: 52, slots: { ...EMPTY_WEEKLY_SLOTS },
  })

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return
    Promise.all([
      fetch(`/api/availability?takumiId=${session.user.id}&full=true`).then((r) => r.json()),
      fetch("/api/bookings?view=takumi").then((r) => r.json()),
      fetch("/api/expert/guest-bookings").then((r) => r.json()),
      fetch("/api/user/takumi-profile").then((r) => r.json()).catch(() => null),
    ])
      .then(([availData, bookingsData, guestData, profileData]) => {
        setSlots(availData.slots || EMPTY_SLOTS)
        setYearlyRules(availData.yearlyRules || [])
        setExceptions(availData.exceptions || [])
        setInstantSlots(availData.instantSlots || EMPTY_SLOTS)
        setBookings(
          (bookingsData.bookings || []).filter(
            (b: Booking) => !["cancelled", "declined"].includes(b.status)
          )
        )
        setGuestBookings(guestData.bookings || [])
        if (profileData?.expert) {
          const p15 = profileData.expert.priceVideo15Min
            ?? (profileData.expert.pricePerSession ? profileData.expert.pricePerSession / 2 : 0)
          setPriceVideo15(Number(p15) || 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  // ── Guest invite handlers ─────────────────────────────────────────────────
  async function handleCreateGuestInvite() {
    if (!guestForm.guestEmail || !guestForm.date || !guestForm.startTime || !guestForm.endTime) {
      toast.error("Bitte alle Pflichtfelder ausfüllen.")
      return
    }
    setGuestCreating(true)
    try {
      const res = await fetch("/api/expert/guest-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...guestForm,
          totalPrice: guestForm.totalPrice ? Number(guestForm.totalPrice) : undefined,
          hostMessage: guestForm.hostMessage || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Fehler beim Erstellen."); return }
      const origin = window.location.origin
      setGuestLink(`${origin}${data.booking.callLink}`)
      setGuestBookings((prev) => [
        {
          id: data.booking.id,
          guestToken: data.booking.guestToken,
          guestEmail: data.booking.guestEmail,
          date: data.booking.date,
          startTime: data.booking.startTime,
          endTime: data.booking.endTime,
          totalPrice: data.booking.totalPrice,
          paymentStatus: "unpaid",
          status: "confirmed",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setGuestForm({ guestEmail: "", date: "", startTime: "10:00", endTime: "11:00", callType: "VIDEO", totalPrice: "", note: "", hostMessage: "" })
      toast.success("Einladungslink erstellt!")
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setGuestCreating(false)
    }
  }

  async function handleCancelGuestBooking(bookingId: string) {
    setGuestCancelling(bookingId)
    try {
      const res = await fetch(`/api/admin/guest-bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      if (res.ok) {
        setGuestBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: "cancelled" } : b))
        toast.success("Einladung storniert.")
      } else {
        const d = await res.json()
        toast.error(d.error || "Fehler beim Stornieren.")
      }
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setGuestCancelling(null)
    }
  }

  function copyGuestLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setGuestCopied(true)
      setTimeout(() => setGuestCopied(false), 2000)
    })
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, yearlyRules, exceptions, instantSlots }),
      })
      const data = await res.json()
      if (res.ok) toast.success(data.message || t("avail.saved"))
      else toast.error(data.error)
    } catch {
      toast.error(t("common.networkError"))
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
        toast.success(action === "confirmed" ? t("avail.bookingConfirmed") : t("avail.bookingDeclined"))
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: action } : b))
        )
      } else toast.error(data.error)
    } catch {
      toast.error(t("common.networkError"))
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
    const dayBookings = bookings
      .filter((b) => b.date === dateStr)
      .sort(compareBookingDateTimeAsc)
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
    const dayBookings = bookings
      .filter((b) => b.date === selectedDate)
      .sort(compareBookingDateTimeAsc)
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
      toast.error(locale === "en" ? "There is already an exception for this day." : locale === "es" ? "Ya existe una excepción para este día." : "Für diesen Tag gibt es bereits eine Ausnahme.")
      return
    }
    const base: IDateException = {
      date:   selectedDate,
      reason: type === "unavailable" ? t("avail.dayUnavailable") : t("avail.dayCustom"),
      type,
      slots:  type === "custom"
        ? (selectedInfo?.resolved.length ? selectedInfo.resolved : [{ start: "09:00", end: "17:00" }])
        : [],
    }
    setExceptions((prev) => [...prev, base])
    toast.success(locale === "en" ? "Exception added — don't forget to save!" : locale === "es" ? "Excepción añadida — ¡no olvides guardar!" : "Ausnahme hinzugefügt — vergiss nicht zu speichern!")
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
    .sort(compareBookingDateTimeAsc)
  const upcomingConfirmed = bookings
    .filter((b) => b.status === "confirmed" && b.date >= todayStr)
    .sort(compareBookingDateTimeAsc)
    .slice(0, 6)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-safe">
      <PageContainer>
        <div className="flex flex-col gap-5">

          <AppSubpageHeader
            title={t("avail.title")}
            subtitle={`${t("avail.tabWeekly")} · ${t("avail.tabInstant")} · ${t("avail.tabSeasonal")} · ${t("avail.tabCalendar")}`}
          />

          {/* Pending bookings alert */}
          {pendingBookings.length > 0 && (
            <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-400">
                  <AlertCircle className="size-4" />
                  {t("avail.pendingRequests")} ({pendingBookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {pendingBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-card p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {b.userId ? (
                          <Link href={`/user/${b.userId}`} className="underline-offset-2 hover:underline">
                            {b.userName}
                          </Link>
                        ) : (
                          b.userName
                        )}
                      </p>
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
                        <CheckCircle className="size-3" /> {t("common.yes")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs border-destructive/30 text-destructive"
                        onClick={() => handleBookingAction(b.id, b.statusToken, "declined")}
                      >
                        <XCircle className="size-3" /> {t("common.no")}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <Tabs
            defaultValue={["schedule","instant","calendar","rules","guest"].includes(searchParams.get("tab") ?? "") ? (searchParams.get("tab") as string) : "schedule"}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="schedule" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Clock className="size-3" /> {t("avail.tabWeekly")}
              </TabsTrigger>
              <TabsTrigger value="instant" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Phone className="size-3" /> {t("avail.tabInstant")}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Calendar className="size-3" /> {t("avail.tabCalendar")}
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <CalendarDays className="size-3" /> {t("avail.tabSeasonal")}
              </TabsTrigger>
              <TabsTrigger value="guest" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <UserPlus className="size-3" /> {t("guestInvite.tab")}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: Buchbare Zeiten (geplante Termine) ─────────────────── */}
            <TabsContent value="schedule">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="size-4 text-primary" />
                    {t("avail.tabWeekly")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("avail.weeklyHint")}
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <WeeklySlotsEditor slots={slots} onChange={setSlots} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Instant-Call Zeiten (ohne Buchung) ────────────────── */}
            <TabsContent value="instant">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-primary" />
                    {t("avail.tabInstant")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("avail.instantHint")}
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <WeeklySlotsEditor slots={instantSlots} onChange={setInstantSlots} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Month Calendar + Day Detail ──────────────────────── */}
            <TabsContent value="calendar">
              <div className="flex flex-col gap-3">

                {/* ── Calendar card ──────────────────────────────────────── */}
                <Card className="overflow-hidden">
                  <CardContent className="p-0">

                    {/* Month navigation header */}
                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full"
                        onClick={prevMonth}
                      >
                        <ChevronLeft className="size-5" />
                      </Button>
                      <div className="text-center">
                        <p className="text-base font-bold leading-tight text-foreground">
                          {MONTH_NAMES[viewMonth]}
                        </p>
                        <p className="text-xs text-muted-foreground">{viewYear}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full"
                        onClick={nextMonth}
                      >
                        <ChevronRight className="size-5" />
                      </Button>
                    </div>

                    <div className="p-3">
                      {/* Day headers */}
                      <div className="mb-1 grid grid-cols-7">
                        {DAY_SHORT_HEADER.map((d, i) => (
                          <div key={d} className="flex items-center justify-center py-1.5">
                            <span className={`text-[11px] font-semibold ${i >= 5 ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                              {d}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden bg-border/20">
                        {calendarDays.map((day, i) => {
                          if (day === null) return (
                            <div key={`e-${i}`} className="bg-background h-12" />
                          )
                          const { dateStr, isPast, isToday, exception, resolved, dayBookings } = getDayInfo(day)
                          const isSelected  = dateStr === selectedDate
                          const isAvailable = resolved.length > 0
                          const isWeekend   = new Date(dateStr + "T00:00:00").getDay() === 0 ||
                                              new Date(dateStr + "T00:00:00").getDay() === 6

                          // Background color by state (only future days)
                          let cellBg = "bg-background"
                          if (!isPast && !isSelected) {
                            if      (exception?.type === "unavailable") cellBg = "bg-red-50 dark:bg-red-950/25"
                            else if (exception?.type === "custom")      cellBg = "bg-amber-50 dark:bg-amber-950/25"
                            else if (isAvailable)                        cellBg = "bg-emerald-50/70 dark:bg-emerald-950/20"
                            else if (isWeekend)                          cellBg = "bg-muted/30"
                          }

                          return (
                            <button
                              key={day}
                              onClick={() => !isPast && setSelectedDate(dateStr === selectedDate ? "" : dateStr)}
                              disabled={isPast}
                              className={[
                                "relative flex h-12 flex-col items-center justify-center gap-0.5 transition-all select-none",
                                cellBg,
                                isSelected
                                  ? "!bg-primary text-primary-foreground z-10 shadow-lg"
                                  : "",
                                !isSelected && !isPast
                                  ? "hover:brightness-95 dark:hover:brightness-110 cursor-pointer active:scale-95"
                                  : "",
                                isPast ? "cursor-default" : "",
                              ].join(" ")}
                            >
                              {/* Day number */}
                              <span
                                className={[
                                  "text-sm font-semibold leading-none",
                                  isSelected   ? "text-primary-foreground" : "",
                                  isToday && !isSelected ? "text-primary" : "",
                                  isPast && !isSelected  ? "text-muted-foreground/30" : "",
                                  !isPast && !isSelected && !isToday ? "text-foreground" : "",
                                ].join(" ")}
                              >
                                {day}
                              </span>

                              {/* Today ring */}
                              {isToday && !isSelected && (
                                <span className="absolute inset-1 rounded-md ring-2 ring-primary/50 pointer-events-none" />
                              )}

                              {/* Booking count pill */}
                              {!isSelected && dayBookings.length > 0 && (
                                <span className="text-[9px] font-bold leading-none text-primary/70">
                                  {dayBookings.length}×
                                </span>
                              )}

                              {/* Exception stripe */}
                              {!isSelected && !isPast && exception?.type === "unavailable" && (
                                <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-destructive/60" />
                              )}
                              {!isSelected && !isPast && exception?.type === "custom" && (
                                <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-amber-500/70" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/40 px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="h-3 w-3 rounded-sm border border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60" />
                        {t("avail.legendAvailable")}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="h-3 w-3 rounded-sm border border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-950/60" />
                        {t("avail.legendUnavailable")}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="h-3 w-3 rounded-sm border border-amber-200 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60" />
                        {t("avail.legendCustom")}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="text-[10px] font-bold text-primary">2×</span>
                        {t("avail.legendBooking")}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Day detail panel (below calendar) ─────────────────── */}
                {selectedDate && selectedInfo ? (
                  <Card className="border-primary/30 bg-gradient-to-b from-primary/[0.03] to-transparent">
                    <CardHeader className="pb-0 pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold text-foreground">
                            {DAY_NAMES[new Date(selectedDate + "T00:00:00").getDay()]},{" "}
                            {formatDisplay(selectedDate)}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("avail.weekPrefix")} {getISOWeek(new Date(selectedDate + "T00:00:00"))} · {MONTH_NAMES[new Date(selectedDate + "T00:00:00").getMonth()]} {new Date(selectedDate + "T00:00:00").getFullYear()}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedDate("")}
                          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <XCircle className="size-4" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">

                        {/* Left column: Status + Times */}
                        <div className="flex flex-col gap-3">
                          {/* Status banner */}
                          <div
                            className={[
                              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium",
                              selectedInfo.exception?.type === "unavailable"
                                ? "bg-destructive/10 text-destructive"
                                : selectedInfo.exception?.type === "custom"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                  : selectedInfo.resolved.length > 0
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground",
                            ].join(" ")}
                          >
                            <Info className="size-4 shrink-0" />
                            <span className="text-xs">
                              {selectedInfo.exception?.type === "unavailable"
                                ? `${t("avail.dayUnavailable")}: ${selectedInfo.exception.reason}`
                                : selectedInfo.exception?.type === "custom"
                                  ? `${t("avail.dayCustom")}: ${selectedInfo.exception.reason}`
                                  : selectedInfo.source === "rule"
                                    ? (locale === "en" ? "Overridden by seasonal rule" : locale === "es" ? "Anulado por regla estacional" : "Überschrieben durch Saison-Regel")
                                    : selectedInfo.resolved.length > 0
                                      ? (locale === "en" ? "Available by default schedule" : locale === "es" ? "Disponible según horario estándar" : "Verfügbar nach Standard-Wochenplan")
                                      : (locale === "en" ? "No schedule for this weekday" : locale === "es" ? "Sin horario para este día" : "Kein Standardplan für diesen Wochentag")}
                            </span>
                          </div>

                          {/* Time slots */}
                          {(selectedInfo.exception?.type === "custom"
                            ? selectedInfo.exception.slots || []
                            : selectedInfo.resolved
                          ).length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {t("avail.timeSlots")}
                              </p>
                              {(selectedInfo.exception?.type === "custom"
                                ? selectedInfo.exception.slots || []
                                : selectedInfo.resolved
                              ).map((s, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                                >
                                  <Clock className="size-3.5 text-primary shrink-0" />
                                  <span className="font-medium tabular-nums">{s.start}</span>
                                  <span className="text-muted-foreground">–</span>
                                  <span className="font-medium tabular-nums">{s.end}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Bookings */}
                          {selectedInfo.dayBookings.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {t("avail.legendBooking")}
                              </p>
                              {selectedInfo.dayBookings.map((b) => (
                                <div
                                  key={b.id}
                                  className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate text-xs font-semibold">
                                      {b.userId ? (
                                        <Link href={`/user/${b.userId}`} className="underline-offset-2 hover:underline">
                                          {b.userName}
                                        </Link>
                                      ) : (
                                        b.userName
                                      )}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground tabular-nums">
                                      {b.startTime} – {b.endTime}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`shrink-0 text-[10px] ${
                                      b.status === "confirmed"
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                        : b.status === "pending"
                                          ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                                          : "border-border bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {b.status === "confirmed" ? t("avail.confirmed") : b.status === "pending" ? t("avail.pending") : b.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right column: Exception controls */}
                        <div className="flex flex-col gap-3 sm:border-l sm:border-border/40 sm:pl-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {locale === "en" ? "Exception for this day" : locale === "es" ? "Excepción para este día" : "Ausnahme für diesen Tag"}
                          </p>

                          {selectedInfo.exception ? (
                            <div className="flex flex-col gap-2.5">
                              {/* Edit reason */}
                              <Input
                                value={selectedInfo.exception.reason}
                                onChange={(e) => updateException(selectedDate, { reason: e.target.value })}
                                placeholder={locale === "en" ? "Reason (e.g. Holiday)" : locale === "es" ? "Motivo (ej. Vacaciones)" : "Grund (z.B. Urlaub, Feiertag)"}
                                className="h-8 text-xs"
                              />

                              {/* Edit custom time slots */}
                              {selectedInfo.exception.type === "custom" && (
                                <div className="flex flex-col gap-2">
                                  {(selectedInfo.exception.slots || []).map((slot, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                      <input
                                        type="time"
                                        step="900"
                                        value={slot.start}
                                        onChange={(e) => {
                                          const s = [...(selectedInfo.exception!.slots || [])]
                                          s[idx] = { ...slot, start: e.target.value }
                                          updateException(selectedDate, { slots: s })
                                        }}
                                        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <span className="text-xs text-muted-foreground">–</span>
                                      <input
                                        type="time"
                                        step="900"
                                        value={slot.end}
                                        onChange={(e) => {
                                          const s = [...(selectedInfo.exception!.slots || [])]
                                          s[idx] = { ...slot, end: e.target.value }
                                          updateException(selectedDate, { slots: s })
                                        }}
                                        className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-7 shrink-0 text-destructive/60 hover:text-destructive"
                                        onClick={() => {
                                          const s = (selectedInfo.exception!.slots || []).filter((_, i) => i !== idx)
                                          updateException(selectedDate, { slots: s })
                                        }}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 gap-1 text-xs text-primary"
                                    onClick={() => {
                                      const s = [...(selectedInfo.exception!.slots || []), { start: "09:00", end: "17:00" }]
                                      updateException(selectedDate, { slots: s })
                                    }}
                                  >
                                    <Plus className="size-3" /> {t("avail.addTimeSlot")}
                                  </Button>
                                </div>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-full gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
                                onClick={() => removeException(selectedDate)}
                              >
                                <Trash2 className="size-3.5" /> {t("avail.exceptionRemove")}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <p className="text-[11px] text-muted-foreground">
                                {locale === "en" ? "Override the default availability for this single day." : locale === "es" ? "Anula la disponibilidad estándar para este día." : "Überschreibe die Standard-Verfügbarkeit für diesen einzelnen Tag."}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
                                onClick={() => addException("unavailable")}
                              >
                                <CalendarX2 className="size-4" />
                                {t("avail.exceptionUnavailable")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 w-full gap-2 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/5"
                                onClick={() => addException("custom")}
                              >
                                <Clock className="size-4" />
                                {t("avail.exceptionCustom")}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-border/50 py-8 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Calendar className="size-7 opacity-25" />
                      <p className="text-xs">{locale === "en" ? "Click a day to edit details" : locale === "es" ? "Haz clic en un día para editar detalles" : "Klicke auf einen Tag um Details zu bearbeiten"}</p>
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
                    {t("avail.tabSeasonal")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {locale === "en" ? "Override the weekly schedule for specific calendar weeks (e.g. summer holidays, off-season)." : locale === "es" ? "Anula el horario semanal para semanas específicas (ej. vacaciones de verano, temporada baja)." : "Überschreibe den Wochenplan für bestimmte Kalenderwochen (z.B. Sommerferien, Nebensaison)."}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {yearlyRules.length === 0 && !showNewRule && (
                    <p className="py-4 text-center text-xs italic text-muted-foreground">
                      {t("avail.noRules")}
                    </p>
                  )}

                  {yearlyRules.map((rule, idx) => (
                    <div key={idx} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{rule.name}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {t("avail.weekPrefix")} {rule.startWeek}–{rule.endWeek}
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
                      <h4 className="mb-3 text-xs font-semibold">{t("avail.addRule")}</h4>
                      <div className="flex flex-col gap-2.5">
                        <Input
                          placeholder={t("avail.ruleNamePlaceholder")}
                          value={newRule.name}
                          onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                          className="h-8 text-xs"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t("avail.weekFrom")}</span>
                          <Input
                            type="number" min={1} max={53}
                            value={newRule.startWeek}
                            onChange={(e) => setNewRule({ ...newRule, startWeek: Number(e.target.value) })}
                            className="h-8 w-16 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">{t("avail.weekTo")}</span>
                          <Input
                            type="number" min={1} max={53}
                            value={newRule.endWeek}
                            onChange={(e) => setNewRule({ ...newRule, endWeek: Number(e.target.value) })}
                            className="h-8 w-16 text-xs"
                          />
                          <Input
                            type="number" min={2024} max={2050}
                            placeholder={locale === "en" ? "Year (opt.)" : locale === "es" ? "Año (opc.)" : "Jahr (opt.)"}
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
                              if (!newRule.name) { toast.error(locale === "en" ? "Please enter a name." : locale === "es" ? "Por favor ingresa un nombre." : "Bitte Namen eingeben."); return }
                              setYearlyRules([...yearlyRules, { ...newRule }])
                              setNewRule({ name: "", startWeek: 1, endWeek: 52, slots: { ...EMPTY_WEEKLY_SLOTS } })
                              setShowNewRule(false)
                              toast.success(locale === "en" ? "Rule added!" : locale === "es" ? "¡Regla añadida!" : "Regel hinzugefügt!")
                            }}
                          >
                            <Plus className="mr-1 size-3" /> {t("avail.addRule")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setShowNewRule(false)}
                          >
                            {t("common.cancel")}
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
                      <Plus className="size-4" /> {t("avail.addRule")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* ── Tab: Gast einladen ────────────────────────────────────── */}
            <TabsContent value="guest">
              <div className="flex flex-col gap-4">

                {/* Create form / link result */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <UserPlus className="size-4 text-primary" />
                      {t("guestInvite.title")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{t("guestInvite.desc")}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {guestLink ? (
                      /* ── Link result ── */
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                          <Link2 className="size-4 shrink-0 text-primary" />
                          <span className="flex-1 truncate text-xs font-mono text-foreground">{guestLink}</span>
                        </div>
                        <Button
                          className="w-full gap-2"
                          onClick={() => copyGuestLink(guestLink)}
                        >
                          {guestCopied ? <><Check className="size-4" /> {t("guestInvite.copied")}</> : <><Copy className="size-4" /> {t("guestInvite.copyLink")}</>}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">{t("guestInvite.shareHint")}</p>
                        <Button variant="outline" className="w-full" onClick={() => setGuestLink(null)}>
                          {t("guestInvite.newInvite")}
                        </Button>
                      </div>
                    ) : (
                      /* ── Form ── */
                      <div className="flex flex-col gap-4">

                        {/* E-Mail */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("guestInvite.guestEmail")} *</label>
                          <input
                            type="email"
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={guestForm.guestEmail}
                            onChange={(e) => setGuestForm((f) => ({ ...f, guestEmail: e.target.value }))}
                            placeholder="gast@beispiel.de"
                          />
                        </div>

                        {/* Kalender – zeigt eigene Verfügbarkeiten */}
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("guestInvite.date")} *
                          </p>
                          {session?.user?.id && (
                            <BookingCalendar
                              takumiId={session.user.id}
                              selectedDate={guestForm.date}
                              selectedTime={guestForm.startTime}
                              onSelect={(date, startTime, endTime) => {
                                setGuestForm((f) => ({ ...f, date, startTime, endTime }))
                              }}
                            />
                          )}
                        </div>

                        {/* Gewählter Slot – editierbar */}
                        {guestForm.date && (
                          <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("guestInvite.startTime")} *</label>
                              <input
                                type="time" step="900"
                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                value={guestForm.startTime}
                                onChange={(e) => setGuestForm((f) => ({ ...f, startTime: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("guestInvite.endTime")} *</label>
                              <input
                                type="time" step="900"
                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                value={guestForm.endTime}
                                onChange={(e) => setGuestForm((f) => ({ ...f, endTime: e.target.value }))}
                              />
                            </div>
                            <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Calendar className="size-3 shrink-0" />
                              <span>{formatDisplay(guestForm.date)} · {guestForm.startTime} – {guestForm.endTime}</span>
                            </div>
                          </div>
                        )}

                        {/* Call-Typ */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("guestInvite.callType")}</label>
                          <select
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={guestForm.callType}
                            onChange={(e) => setGuestForm((f) => ({ ...f, callType: e.target.value }))}
                          >
                            <option value="VIDEO">Video</option>
                            <option value="VOICE">Audio</option>
                          </select>
                        </div>

                        {/* ── Preis ────────────────────────────────────────── */}
                        {(() => {
                          const [sh, sm] = (guestForm.startTime || "0:0").split(":").map(Number)
                          const [eh, em] = (guestForm.endTime   || "0:0").split(":").map(Number)
                          const durationMin = Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
                          const autoPrice = (priceVideo15 > 0 && durationMin > 0)
                            ? Math.round(priceVideo15 * (durationMin / 15) * 100) / 100
                            : null
                          const customPrice = guestForm.totalPrice !== "" ? Number(guestForm.totalPrice) : null
                          const displayPrice = customPrice ?? autoPrice

                          const fmtEur = (n: number) =>
                            n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"

                          return (
                            <div className="flex flex-col gap-2">

                              {/* Preis-Anzeige – immer sichtbar sobald Datum gewählt */}
                              <div className={[
                                "flex items-center justify-between rounded-xl border px-4 py-3",
                                displayPrice !== null
                                  ? customPrice !== null
                                    ? "border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20"
                                    : "border-primary/30 bg-primary/5"
                                  : "border-border/60 bg-muted/30",
                              ].join(" ")}>
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    {durationMin > 0 ? `${durationMin} Min · ` : ""}
                                    {locale === "en" ? "Total amount" : "Gesamtbetrag"}
                                    {displayPrice !== null && customPrice === null && (
                                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                        {locale === "en" ? "auto" : "berechnet"}
                                      </span>
                                    )}
                                    {customPrice !== null && (
                                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                        {locale === "en" ? "custom" : "individuell"}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-2xl font-bold text-foreground">
                                    {displayPrice !== null
                                      ? fmtEur(displayPrice)
                                      : <span className="text-base text-muted-foreground">–</span>}
                                  </p>
                                </div>
                                {customPrice !== null && (
                                  <button
                                    type="button"
                                    onClick={() => setGuestForm((f) => ({ ...f, totalPrice: "" }))}
                                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                  >
                                    {locale === "en" ? "Reset" : "Zurücksetzen"}
                                  </button>
                                )}
                              </div>

                              {/* Individuellen Preis eingeben */}
                              <div className="rounded-xl border border-dashed border-border/60 px-4 py-3">
                                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                  {locale === "en" ? "Or enter a custom price (€)" : locale === "es" ? "O introduce un precio personalizado (€)" : "Oder individuellen Preis eingeben (€)"}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  value={guestForm.totalPrice}
                                  onChange={(e) => setGuestForm((f) => ({ ...f, totalPrice: e.target.value }))}
                                  placeholder={autoPrice !== null
                                    ? fmtEur(autoPrice)
                                    : locale === "en" ? "e.g. 99.00" : "z.B. 99,00"}
                                />
                                {autoPrice !== null && (
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {locale === "en"
                                      ? `Leave blank to use auto-calculated price (${fmtEur(autoPrice)}).`
                                      : `Leer lassen = berechneter Preis (${fmtEur(autoPrice)}) wird verwendet.`}
                                  </p>
                                )}
                              </div>

                            </div>
                          )
                        })()}

                        {/* Persönliche Nachricht an Gast */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            {locale === "en" ? "Personal message to guest" : locale === "es" ? "Mensaje personal al invitado" : "Persönliche Nachricht an den Gast"}
                            <span className="ml-1 text-muted-foreground/60">({locale === "en" ? "optional, appears in invitation email" : locale === "es" ? "opcional, aparece en el correo" : "optional, erscheint in der Einladungs-E-Mail"})</span>
                          </label>
                          <textarea
                            rows={2}
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            value={guestForm.hostMessage}
                            onChange={(e) => setGuestForm((f) => ({ ...f, hostMessage: e.target.value }))}
                            placeholder={locale === "en" ? "e.g. Looking forward to our conversation about your project!" : locale === "es" ? "ej. ¡Espero con interés nuestra conversación!" : "z.B. Ich freue mich auf unser Gespräch zu deinem Projekt!"}
                          />
                        </div>

                        {/* Interne Notiz */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            {t("guestInvite.note")}
                            <span className="ml-1 text-muted-foreground/60">({locale === "en" ? "internal, not sent" : locale === "es" ? "interna, no se envía" : "intern, wird nicht versendet"})</span>
                          </label>
                          <input
                            type="text"
                            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={guestForm.note}
                            onChange={(e) => setGuestForm((f) => ({ ...f, note: e.target.value }))}
                            placeholder="z.B. Erstgespräch Projekt X"
                          />
                        </div>

                        <Button
                          className="w-full gap-2"
                          onClick={handleCreateGuestInvite}
                          disabled={guestCreating}
                        >
                          {guestCreating
                            ? <><Loader2 className="size-4 animate-spin" /> {t("guestInvite.creating")}</>
                            : <><UserPlus className="size-4" /> {t("guestInvite.create")}</>
                          }
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* List of past guest invites */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Calendar className="size-4 text-primary" />
                      {t("guestInvite.myInvites")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {guestBookings.length === 0 ? (
                      <p className="py-4 text-center text-xs italic text-muted-foreground">{t("guestInvite.noInvites")}</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {guestBookings.map((gb) => {
                          const link = `${typeof window !== "undefined" ? window.location.origin : ""}/call/${gb.guestToken}`
                          const isPaid = gb.paymentStatus === "paid"
                          const isCancelled = gb.status === "cancelled"
                          return (
                            <div key={gb.id} className={`rounded-xl border p-3 ${isCancelled ? "opacity-50" : ""}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold">{gb.guestEmail}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {formatDisplay(gb.date)} · {gb.startTime}–{gb.endTime}
                                    {gb.totalPrice ? ` · ${Number(gb.totalPrice).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : ""}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-[10px] ${
                                    isCancelled ? "border-muted text-muted-foreground" :
                                    isPaid ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" :
                                    "border-amber-500/30 bg-amber-500/10 text-amber-600"
                                  }`}
                                >
                                  {isCancelled ? t("guestInvite.statusCancelled") : isPaid ? t("guestInvite.statusPaid") : t("guestInvite.statusUnpaid")}
                                </Badge>
                              </div>
                              {!isCancelled && (
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 flex-1 gap-1 text-xs"
                                    onClick={() => copyGuestLink(link)}
                                  >
                                    <Copy className="size-3" /> {t("guestInvite.copyLink")}
                                  </Button>
                                  {!isPaid && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
                                      disabled={guestCancelling === gb.id}
                                      onClick={() => handleCancelGuestBooking(gb.id)}
                                    >
                                      {guestCancelling === gb.id
                                        ? <Loader2 className="size-3 animate-spin" />
                                        : <XCircle className="size-3" />
                                      }
                                      {t("guestInvite.cancel")}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

          </Tabs>

          {/* Upcoming confirmed bookings */}
          {upcomingConfirmed.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-primary" />
                    {t("avail.confirmedAppointments")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {upcomingConfirmed.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium">
                        {b.userId ? (
                          <Link href={`/user/${b.userId}`} className="underline-offset-2 hover:underline">
                            {b.userName}
                          </Link>
                        ) : (
                          b.userName
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDisplay(b.date)} · {b.startTime}–{b.endTime}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/5 text-primary">
                      {t("avail.confirmed")}
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
              <><Loader2 className="size-4 animate-spin" /> {t("avail.saving")}</>
            ) : (
              <><Save className="size-4" /> {t("avail.saveAll")}</>
            )}
          </Button>

        </div>
      </PageContainer>
    </div>
  )
}

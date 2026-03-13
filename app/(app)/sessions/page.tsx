"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { PageContainer } from "@/components/page-container"
import { BookingCard } from "@/components/booking-card"
import { scheduleSessionReminder, cancelPastReminders } from "@/lib/native-utils"
import { getCachedBookings, setCachedBookings } from "@/lib/offline-cache"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Video, CalendarCheck, CheckCircle2, Inbox } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import type { BookingRecord } from "@/lib/types"

type TabId = "active" | "upcoming" | "completed"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** Map booking status to tab category (aktiv | geplant | fertig) */
function tabForStatus(status: string): TabId {
  if (status === "active") return "active"             // Aktiv: laufender Call
  if (status === "pending" || status === "confirmed") return "upcoming"  // Geplant
  return "completed"  // Fertig: completed, declined, cancelled
}

function EmptyState({ tab }: { tab: TabId }) {
  const { t } = useI18n()
  const messages: Record<TabId, { title: string; desc: string }> = {
    active: {
      title: t("sessions.emptyActiveTitle"),
      desc: t("sessions.emptyActiveDesc"),
    },
    upcoming: {
      title: t("sessions.emptyUpcomingTitle"),
      desc: t("sessions.emptyUpcomingDesc"),
    },
    completed: {
      title: t("sessions.emptyCompletedTitle"),
      desc: t("sessions.emptyCompletedDesc"),
    },
  }

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Inbox className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground">{messages[tab].title}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">{messages[tab].desc}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}

/** Inner content that uses useSearchParams – must be wrapped in Suspense to avoid prerender errors */
function SessionsContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const initialTab: TabId =
    tabParam === "upcoming" || tabParam === "completed" ? tabParam : "active"
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  useEffect(() => {
    if (tabParam === "upcoming" || tabParam === "completed") {
      setActiveTab(tabParam)
    }
  }, [tabParam])
  const [cachedBookings, setCachedBookingsState] = useState<BookingRecord[] | null>(null)
  useEffect(() => {
    getCachedBookings().then((b) => b && setCachedBookingsState(b))
  }, [])

  const { data, isLoading, mutate } = useSWR<{ bookings: BookingRecord[] }>(
    "/api/bookings",
    fetcher,
    {
      refreshInterval: 10000,
      fallbackData: cachedBookings ? { bookings: cachedBookings } : undefined,
    }
  )
  useEffect(() => {
    if (data?.bookings?.length) setCachedBookings(data.bookings)
  }, [data?.bookings])

  const displayBookings = data?.bookings ?? cachedBookings ?? []

  // Callback to refresh list after cancellation
  const handleCancelled = () => mutate()

  const tabs = [
    { id: "active" as const, label: t("sessions.tabActive"), icon: Video },
    { id: "upcoming" as const, label: t("sessions.tabUpcoming"), icon: CalendarCheck },
    { id: "completed" as const, label: t("sessions.tabCompleted"), icon: CheckCircle2 },
  ]

  const bookings = displayBookings
  // Local Notifications: Erinnerungen für bestätigte Sessions (30 Min vor Start)
  useEffect(() => {
    const confirmed = bookings.filter((b) => b.status === "confirmed")
    const now = new Date()
    const past: string[] = []
    for (const b of confirmed) {
      const [y, m, d] = (b.date || "").split("-").map(Number)
      const [h, min] = (b.startTime || "00:00").split(":").map(Number)
      const at = new Date(y, m - 1, d, h, min, 0)
      if (at.getTime() > now.getTime()) {
        scheduleSessionReminder({ id: b.id, expertName: b.expertName, date: b.date, startTime: b.startTime || "00:00" })
      } else {
        past.push(b.id)
      }
    }
    const toCancel = bookings
      .filter((b) => ["completed", "declined", "cancelled"].includes(b.status) || past.includes(b.id))
      .map((b) => b.id)
    if (toCancel.length > 0) cancelPastReminders([...new Set(toCancel)])
  }, [bookings])

  const filtered = bookings
    .filter((b) => tabForStatus(b.status) === activeTab)
    .sort((a, b) => {
      const key = (x: BookingRecord) => `${x.date}T${x.startTime || "00:00"}`
      if (activeTab === "upcoming" || activeTab === "active") {
        return key(a).localeCompare(key(b))
      }
      return key(b).localeCompare(key(a))
    })

  // Count for tab badges
  const activeCount = bookings.filter((b) => tabForStatus(b.status) === "active").length

  return (
    <PageContainer>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
            {tab.id === "active" && activeCount > 0 && (
              <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="mt-4 flex flex-col gap-3">
        {isLoading && displayBookings.length === 0 ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          filtered.map((booking) => (
            <BookingCard key={booking.id || booking._id} booking={booking} onCancelled={handleCancelled} />
          ))
        )}
      </div>
      <div className="scroll-end-spacer" aria-hidden />
    </PageContainer>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<PageContainer><LoadingSkeleton /></PageContainer>}>
      <SessionsContent />
    </Suspense>
  )
}

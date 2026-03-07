"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { PageContainer } from "@/components/page-container"
import { BookingCard } from "@/components/booking-card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Video, CalendarCheck, CheckCircle2, Inbox } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import type { BookingRecord } from "@/lib/types"

type TabId = "active" | "upcoming" | "completed"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** Map booking status to tab category */
function tabForStatus(status: string): TabId {
  if (status === "active") return "active"
  if (status === "pending" || status === "confirmed") return "upcoming"
  return "completed" // completed, declined, cancelled
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

export default function SessionsPage() {
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
  const { data, isLoading, mutate } = useSWR<{ bookings: BookingRecord[] }>("/api/bookings", fetcher, {
    refreshInterval: 10000, // refresh every 10s to catch live status changes
  })

  // Callback to refresh list after cancellation
  const handleCancelled = () => mutate()

  const tabs = [
    { id: "active" as const, label: t("sessions.tabActive"), icon: Video },
    { id: "upcoming" as const, label: t("sessions.tabUpcoming"), icon: CalendarCheck },
    { id: "completed" as const, label: t("sessions.tabCompleted"), icon: CheckCircle2 },
  ]

  const bookings = data?.bookings || []
  const filtered = bookings.filter((b) => tabForStatus(b.status) === activeTab)

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
        {isLoading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          filtered.map((booking) => (
            <BookingCard key={booking._id} booking={booking} onCancelled={handleCancelled} />
          ))
        )}
      </div>
    </PageContainer>
  )
}

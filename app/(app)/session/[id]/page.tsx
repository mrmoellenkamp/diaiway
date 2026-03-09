"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DailyCallContainer } from "@/components/video-call/DailyCallContainer"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/lib/i18n"

type CallMode = "video" | "voice"
type UserRole = "shugyo" | "takumi"

interface BookingData {
  booking: {
    id: string
    callType: "VIDEO" | "VOICE"
    isExpert: boolean
    userName: string
    takumiName: string
    takumiImageUrl: string
    userImageUrl: string
    status: string
  }
}

function SessionCallContent() {
  const params = useParams()
  const router = useRouter()
  const { t } = useI18n()
  const bookingId = params.id as string

  const [data, setData] = useState<BookingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`)
        if (!res.ok) {
          const err = (await res.json()).error ?? "Buchung nicht gefunden"
          if (!cancelled) setError(err)
          return
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Fehler beim Laden")
      }
    }
    fetchBooking()
    return () => {
      cancelled = true
    }
  }, [bookingId])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push("/sessions")}>
          {t("sessions.backToSessions")}
        </Button>
      </div>
    )
  }

  if (!data) return <SessionSkeleton />

  const { booking } = data
  const callMode: CallMode = booking.callType === "VIDEO" ? "video" : "voice"
  const userRole: UserRole = booking.isExpert ? "takumi" : "shugyo"
  const partnerName = booking.isExpert ? booking.userName : booking.takumiName
  const partnerImageUrl = booking.isExpert ? booking.userImageUrl : booking.takumiImageUrl

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:min-h-[80vh]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <DailyCallContainer
          bookingId={booking.id}
          callMode={callMode}
          userRole={userRole}
          partnerImageUrl={partnerImageUrl || undefined}
          partnerName={partnerName}
        />
      </div>
      <div className="shrink-0 border-t px-4 py-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/sessions")}
        >
          {t("sessions.backToSessions")}
        </Button>
      </div>
    </div>
  )
}

function SessionSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col gap-4 overflow-hidden p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="aspect-video w-full flex-1 rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  )
}

export default function SessionCallPage() {
  return (
    <div className="h-dvh overflow-hidden md:min-h-screen">
      <Suspense fallback={<SessionSkeleton />}>
        <SessionCallContent />
      </Suspense>
    </div>
  )
}

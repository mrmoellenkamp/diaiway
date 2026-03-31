"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Phone, Loader2, CheckCircle, XCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface InstantRequest {
  id: string
  userName: string
  statusToken: string
  createdAt: string
}

const POLL_INTERVAL_MS = 3000

export function InstantRequestOverlay() {
  const { t } = useI18n()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [requests, setRequests] = useState<InstantRequest[]>([])
  const [actioning, setActioning] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const appRole = (session?.user as { appRole?: string })?.appRole
    if (status !== "authenticated" || appRole !== "takumi") return

    function poll() {
      fetch("/api/expert/instant-requests", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.requests) && data.requests.length > 0) {
            setRequests(data.requests)
            if (!audioRef.current) {
              try {
                audioRef.current = new Audio("/sounds/ringtone.mp3")
                audioRef.current.loop = true
                audioRef.current.play().catch(() => {})
              } catch {
                // Ringtone optional
              }
            } else {
              audioRef.current.play().catch(() => {})
            }
          } else {
            setRequests([])
            audioRef.current?.pause?.()
          }
        })
        .catch(() => {})
    }

    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      audioRef.current?.pause?.()
    }
  }, [session, status])

  async function handleAction(bookingId: string, token: string, action: "confirmed" | "declined") {
    setActioning(bookingId)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
        credentials: "include",
      })
      if (res.ok) {
        audioRef.current?.pause?.()
        setRequests((prev) => prev.filter((r) => r.id !== bookingId))
        if (action === "confirmed") {
          router.push(`/session/${bookingId}`)
        }
      } else {
        const data = await res.json()
        alert(data?.error ?? t("common.error"))
      }
    } catch {
      alert(t("common.networkError"))
    } finally {
      setActioning(null)
    }
  }

  if (requests.length === 0) return null

  const req = requests[0]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 flex flex-col items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-[rgba(6,78,59,0.2)]">
          <Phone className="size-8 text-primary animate-pulse" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-foreground">Instant-Anfrage</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("instant.requestWantsConnect", { name: req.userName })}
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1 gap-2 border-[rgba(239,68,68,0.4)] text-destructive hover:bg-[rgba(239,68,68,0.1)]"
            disabled={!!actioning}
            onClick={() => handleAction(req.id, req.statusToken, "declined")}
          >
            {actioning === req.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            {t("messages.bookingDecline")}
          </Button>
          <Button
            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
            disabled={!!actioning}
            onClick={() => handleAction(req.id, req.statusToken, "confirmed")}
          >
            {actioning === req.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle className="size-4" />
            )}
            {t("messages.bookingConfirm")}
          </Button>
        </div>
      </div>
    </div>
  )
}

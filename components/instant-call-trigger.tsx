"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Phone, Loader2 } from "lucide-react"
import { useWalletTopup } from "@/lib/wallet-topup-context"
import type { Takumi } from "@/lib/types"

interface InstantCallTriggerProps {
  takumi: Takumi
  variant?: "card" | "profile"
  className?: string
  onRequestCreated?: (bookingId: string) => void
}

export function InstantCallTrigger({
  takumi,
  variant = "card",
  className = "",
  onRequestCreated,
}: InstantCallTriggerProps) {
  const { openWalletTopup } = useWalletTopup()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [instantCheck, setInstantCheck] = useState<{
    hasPaidBefore?: boolean
    hasSufficientBalance?: boolean
    instantAvailableNow?: boolean
  } | null>(null)

  useEffect(() => {
    if (takumi.liveStatus !== "available") return
    fetch(`/api/bookings/instant-check?expertId=${encodeURIComponent(takumi.id)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(setInstantCheck)
      .catch(() => {})
  }, [takumi.id, takumi.liveStatus])

  if (takumi.liveStatus !== "available") return null

  const instantAvailableNow = instantCheck?.instantAvailableNow ?? true

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading || checking || !instantAvailableNow) return

    setChecking(true)
    try {
      const checkRes = await fetch(
        `/api/bookings/instant-check?expertId=${encodeURIComponent(takumi.id)}`,
        { credentials: "include" }
      )
      const check = await checkRes.json()

      if (!check.hasSufficientBalance) {
        openWalletTopup(() => {
          handleClick(e)
        })
        setChecking(false)
        return
      }

      setLoading(true)
      const res = await fetch("/api/bookings/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId: takumi.id }),
        credentials: "include",
      })
      const data = await res.json()

      if (res.ok && data?.booking?.id) {
        onRequestCreated?.(data.booking.id)
        if (variant === "profile") {
          window.location.href = `/session/${data.booking.id}?wait=true`
        }
      } else {
        alert(data?.error || "Fehler beim Anklopfen")
      }
    } catch {
      alert("Netzwerkfehler")
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }

  const hasPaidBefore = instantCheck?.hasPaidBefore ?? false
  const buttonText = hasPaidBefore
    ? "Direkt weitermachen"
    : "Neues Projekt starten"
  const subtitle = hasPaidBefore
    ? "Abrechnung ab Sekunde 31"
    : "5 Min. Begrüßung gratis"

  return (
    <Button
      onClick={handleClick}
      disabled={loading || checking || !instantAvailableNow}
      title={!instantAvailableNow ? "Aktuell außerhalb der Instant-Call-Sprechzeiten" : undefined}
      className={`gap-2 ${variant === "card" ? "h-9 text-sm" : "h-12 w-full"} ${className}`}
      size={variant === "card" ? "sm" : "lg"}
    >
      {loading || checking ? (
        <Loader2 className="size-4 animate-spin shrink-0" />
      ) : (
        <Phone className="size-4 shrink-0" />
      )}
      <span className="flex flex-col items-start">
        <span>{checking ? "Prüfe..." : loading ? "Anklopfen..." : buttonText}</span>
        {variant === "profile" && (
          <span className="text-[10px] font-normal opacity-90">{subtitle}</span>
        )}
      </span>
    </Button>
  )
}

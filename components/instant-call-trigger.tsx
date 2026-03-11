"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Phone, Loader2, Video, Mic } from "lucide-react"
import { useWalletTopup } from "@/lib/wallet-topup-context"
import type { Takumi } from "@/lib/types"
import { cn } from "@/lib/utils"

type CallTypeChoice = "VIDEO" | "VOICE"

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [callType, setCallType] = useState<CallTypeChoice>("VIDEO")
  const [costConfirmed, setCostConfirmed] = useState(false)
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
  const priceVideo = takumi.priceVideo15Min ?? (takumi.pricePerSession ? takumi.pricePerSession / 2 : 0)
  const priceVoice = takumi.priceVoice15Min ?? (takumi.pricePerSession ? takumi.pricePerSession / 2 : 0)
  const pricePer15 = callType === "VIDEO" ? priceVideo : priceVoice
  const pricePerMin = pricePer15 / 15

  async function doInstantCall(e: React.MouseEvent) {
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
          setShowConfirmDialog(true)
          doInstantCall(e)
        })
        setChecking(false)
        return
      }

      setLoading(true)
      const res = await fetch("/api/bookings/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId: takumi.id, callType }),
        credentials: "include",
      })
      const data = await res.json()

      if (res.ok && data?.booking?.id) {
        setShowConfirmDialog(false)
        setCostConfirmed(false)
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

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading || checking || !instantAvailableNow) return
    setShowConfirmDialog(true)
  }

  function handleConfirm(e: React.MouseEvent) {
    if (!costConfirmed) return
    doInstantCall(e)
  }

  const hasPaidBefore = instantCheck?.hasPaidBefore ?? false
  const buttonText = hasPaidBefore
    ? "Instant Connect"
    : "Neues Projekt starten"
  const subtitle = hasPaidBefore
    ? "Abrechnung ab Sekunde 31"
    : "5 Min. Begrüßung gratis"

  return (
    <>
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

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instant Connect – Art &amp; Kosten</DialogTitle>
            <DialogDescription>
              Wähle Video oder Voice und bestätige die entstehenden Kosten.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCallType("VIDEO")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                  callType === "VIDEO"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <Video className="size-6 text-primary" />
                <span className="text-sm font-medium">Video-Call</span>
                <span className="text-xs text-muted-foreground">
                  {(priceVideo * 4).toFixed(2)} € / 60 Min
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCallType("VOICE")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all",
                  callType === "VOICE"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <Mic className="size-6 text-primary" />
                <span className="text-sm font-medium">Voice-Call</span>
                <span className="text-xs text-muted-foreground">
                  {(priceVoice * 4).toFixed(2)} € / 60 Min
                </span>
              </button>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium text-foreground">
                Abrechnung: {callType === "VIDEO" ? "Video" : "Voice"} · {pricePerMin.toFixed(2)} € / Min
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Erste 5 Min. gratis (bzw. 30 Sek. bei Wiederholungsnutzern).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cost-confirm"
                checked={costConfirmed}
                onCheckedChange={(v) => setCostConfirmed(v === true)}
              />
              <label htmlFor="cost-confirm" className="text-sm font-medium cursor-pointer">
                Ich bestätige die entstehenden Kosten.
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!costConfirmed || loading || checking}
              className="gap-2"
            >
              {loading || checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Phone className="size-4" />
              )}
              Verbinden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

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
import { useI18n } from "@/lib/i18n"

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
  const { t } = useI18n()
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
        alert(data?.error || t("instant.knockError"))
      }
    } catch {
      alert(t("common.networkError"))
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
    ? t("instant.connectNow")
    : t("instant.startNewProject")
  const subtitle = hasPaidBefore
    ? t("instant.billingFromSecond31")
    : t("instant.greeting5MinFree")

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading || checking || !instantAvailableNow}
        title={!instantAvailableNow ? t("instant.outsideOfficeHours") : undefined}
        className={`gap-2 ${variant === "card" ? "h-9 text-sm" : "h-12 w-full"} ${className}`}
        size={variant === "card" ? "sm" : "lg"}
      >
        {loading || checking ? (
          <Loader2 className="size-4 animate-spin shrink-0" />
        ) : (
          <Phone className="size-4 shrink-0" />
        )}
        <span className="flex flex-col items-start">
          <span>{checking ? t("instant.checking") : loading ? t("instant.knocking") : buttonText}</span>
          {variant === "profile" && (
            <span className="text-[10px] font-normal opacity-90">{subtitle}</span>
          )}
        </span>
      </Button>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("instant.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("instant.dialogDesc")}
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
                <span className="text-sm font-medium">{t("booking.videoCall")}</span>
                <span className="text-xs text-muted-foreground">
                  {(priceVideo * 4).toFixed(2)} € / 60 {t("booking.minutesShort")}
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
                <span className="text-sm font-medium">{t("booking.voiceCall")}</span>
                <span className="text-xs text-muted-foreground">
                  {(priceVoice * 4).toFixed(2)} € / 60 {t("booking.minutesShort")}
                </span>
              </button>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium text-foreground">
                {t("instant.billingLine")
                  .replace("{mode}", callType === "VIDEO" ? t("booking.videoShort") : t("booking.voiceShort"))
                  .replace("{price}", pricePerMin.toFixed(2))
                  .replace("{unit}", t("booking.minutesShort"))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("instant.trialHint")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="cost-confirm"
                checked={costConfirmed}
                onCheckedChange={(v) => setCostConfirmed(v === true)}
              />
              <label htmlFor="cost-confirm" className="text-sm font-medium cursor-pointer">
                {t("instant.confirmCosts")}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              {t("common.cancel")}
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
              {t("landing.connect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

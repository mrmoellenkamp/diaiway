"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Loader2, Radio, Wifi } from "lucide-react"
import { useI18n } from "@/lib/i18n"

/**
 * Status-Card im Takumi-Dashboard: Switch zwischen OFFLINE und AVAILABLE.
 * Beeinflusst liveStatus in der Expert-Tabelle.
 */
export function TakumiStatusCard() {
  const { locale } = useI18n()
  const [liveStatus, setLiveStatus] = useState<"offline" | "available" | null>(null)
  const [profileApproved, setProfileApproved] = useState<boolean | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetch("/api/expert/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const s = data?.expert?.liveStatus ?? "offline"
        setLiveStatus(s === "available" ? "available" : "offline")
        setProfileApproved(data?.expert?.profileReviewStatus === "approved")
      })
      .catch(() => setLiveStatus("offline"))
  }, [])

  async function handleToggle(checked: boolean) {
    const next = checked ? "available" : "offline"
    setUpdating(true)
    try {
      const res = await fetch("/api/expert/live-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveStatus: next }),
        credentials: "include",
      })
      if (res.ok) {
        setLiveStatus(next)
      }
    } catch {
      /* revert in UI wäre möglich */
    } finally {
      setUpdating(false)
    }
  }

  if (liveStatus === null || profileApproved === null) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  const isAvailable = liveStatus === "available"
  const blocked = !profileApproved
  const statusLabel =
    locale === "en"
      ? isAvailable
        ? "Available for Instant Call"
        : "Offline"
      : locale === "es"
        ? isAvailable
          ? "Disponible para llamada"
          : "Desconectado"
        : isAvailable
          ? "Verfügbar für Instant-Call"
          : "Offline"

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isAvailable ? (
            <Radio className="size-4 text-emerald-500" />
          ) : (
            <Wifi className="size-4 text-muted-foreground" />
          )}
          {locale === "en"
            ? "Instant-Connect Status"
            : locale === "es"
              ? "Estado Instant-Connect"
              : "Instant-Connect Status"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        {blocked && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {locale === "en"
              ? "Your expert profile must be approved before you can use Instant-Connect."
              : locale === "es"
                ? "Tu perfil de experto debe ser aprobado antes de usar Instant-Connect."
                : "Dein Experten-Profil muss freigegeben sein, bevor du Instant-Connect nutzen kannst."}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span
            className={`text-sm font-medium ${isAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
          >
            {statusLabel}
          </span>
          <Switch
            checked={isAvailable}
            onCheckedChange={handleToggle}
            disabled={updating || blocked}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>
      </CardContent>
    </Card>
  )
}

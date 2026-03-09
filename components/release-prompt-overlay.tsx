"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

interface ReleasePromptOverlayProps {
  isOpen: boolean
  bookingId: string
  onRelease: () => void
  onReportProblem: () => void
}

export function ReleasePromptOverlay({
  isOpen,
  bookingId,
  onRelease,
  onReportProblem,
}: ReleasePromptOverlayProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState<"release" | "problem" | null>(null)
  const [error, setError] = useState("")

  if (!isOpen) return null

  async function handleRelease() {
    setLoading("release")
    setError("")
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release-payment" }),
      })
      const data = await res.json()
      if (res.ok) {
        onRelease()
      } else {
        setError(data.error || t("release.releaseFailed"))
      }
    } catch {
      setError(t("common.networkError"))
    } finally {
      setLoading(null)
    }
  }

  async function handleReportProblem() {
    setLoading("problem")
    setError("")
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report-problem" }),
      })
      const data = await res.json()
      if (res.ok) {
        onReportProblem()
      } else {
        setError(data.error || t("release.problemFailed"))
      }
    } catch {
      setError(t("common.networkError"))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-handshake-enter">
      <div className="relative mx-4 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl bg-card p-8 text-center shadow-2xl">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-8 text-primary" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-foreground">
            {t("release.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("release.desc")}
          </p>
        </div>

        {error && (
          <div className="w-full rounded-lg bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={handleRelease}
            disabled={!!loading}
            className="h-12 w-full gap-2"
          >
            {loading === "release" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {t("release.releaseNow")}
          </Button>
          <Button
            onClick={handleReportProblem}
            variant="outline"
            disabled={!!loading}
            className="h-12 w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            {loading === "problem" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <AlertTriangle className="size-4" />
            )}
            {t("release.reportProblem")}
          </Button>
        </div>
      </div>
    </div>
  )
}

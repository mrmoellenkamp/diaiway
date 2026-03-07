"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Video, Clock, Calendar, Phone, X, Loader2, AlertTriangle, CheckCircle2, UserX } from "lucide-react"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import { formatDateBerlin, formatDateBerlinShort } from "@/lib/date-utils"
import type { BookingRecord } from "@/lib/types"

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: "Ausstehend",     className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400" },
  confirmed: { label: "Bestaetigt",     className: "bg-primary/10 text-primary border-primary/30" },
  active:    { label: "Live",           className: "bg-accent/15 text-accent border-accent/30" },
  completed: { label: "Abgeschlossen",  className: "bg-muted text-muted-foreground border-border" },
  declined:  { label: "Abgelehnt",      className: "bg-destructive/10 text-destructive border-destructive/30" },
  cancelled: { label: "Storniert",      className: "bg-destructive/10 text-destructive border-destructive/30" },
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace(".", ",")}`
}

interface CancelPreview {
  isFree: boolean
  hoursUntilSession: number
  freeHours: number
  feePercent: number
  feeAmount: number
  refundAmount: number
}

export function BookingCard({
  booking,
  onCancelled,
}: {
  booking: BookingRecord
  onCancelled?: () => void
}) {
  const { t } = useI18n()
  const { data: session } = useSession()
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null)
  const [isExpertCancelling, setIsExpertCancelling] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const status = statusConfig[booking.status] || statusConfig.pending
  const isLive = booking.status === "active"
  const canJoin = booking.status === "confirmed" || booking.status === "active"
  const canCancel = ["pending", "confirmed", "active"].includes(booking.status)
  const bookingId = booking.id || booking._id || ""

  // When dialog opens, fetch real-time cancel fee preview
  useEffect(() => {
    if (!dialogOpen || !canCancel || !bookingId) return
    fetch(`/api/bookings/${bookingId}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((data) => {
        if (data.preview) setCancelPreview(data.preview)
        if (data.isExpertCancelling !== undefined) setIsExpertCancelling(data.isExpertCancelling)
      })
      .catch(() => {/* silent – we'll show generic message */})
  }, [dialogOpen, canCancel, bookingId])

  async function handleCancel() {
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (res.ok) {
        let msg = t("booking.cancelled")
        if (data.refund?.refunded) {
          if (data.refund.partial && data.feeAmount > 0) {
            msg = t("booking.cancelledPartialRefund")
              .replace("{fee}", formatCents(data.feeAmount))
              .replace("{refund}", formatCents(data.refundAmount))
          } else {
            msg = t("booking.cancelledFullRefund")
          }
        }
        toast.success(msg)
        onCancelled?.()
      } else {
        toast.error(data.error || t("booking.cancelFailed"))
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setIsCancelling(false)
      setDialogOpen(false)
    }
  }

  // Determine the current user role in this booking
  const currentUserId = session?.user?.id
  const isExpertView = booking.userId !== currentUserId

  return (
    <Card className="gap-0 overflow-hidden border-border/60 py-0 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        <Avatar className="size-12 shrink-0 border-2 border-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {getInitials(isExpertView ? booking.userName : booking.takumiName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-foreground">
              {isExpertView ? booking.userName : booking.takumiName}
            </span>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${status.className}`}>
              {isLive && (
                <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
              )}
              {status.label}
            </Badge>
          </div>

          {!isExpertView && booking.takumiSubcategory && (
            <p className="text-xs text-muted-foreground">{booking.takumiSubcategory}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDateBerlinShort(new Date(booking.date + "T12:00:00Z"))}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {booking.startTime} - {booking.endTime}
            </span>
            {booking.sessionDuration != null && (
              <span className="flex items-center gap-1">
                <Video className="size-3" />
                {booking.sessionDuration} Min
              </span>
            )}
          </div>

          {/* Cancellation info for already-cancelled bookings */}
          {booking.status === "cancelled" && booking.cancelledBy && (
            <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              <UserX className="size-3 shrink-0" />
              <span>
                {booking.cancelledBy === "expert"
                  ? t("booking.cancelledByExpert")
                  : t("booking.cancelledByUser")}
                {booking.cancelFeeAmount && booking.cancelFeeAmount > 0
                  ? ` · ${t("booking.feeRetained").replace("{fee}", formatCents(booking.cancelFeeAmount))}`
                  : ""}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-2 flex gap-2">
            {canJoin && (
              <Link href={`/session/${bookingId}`} className="flex-1">
                <Button
                  size="sm"
                  className={
                    isLive
                      ? "h-9 w-full animate-pulse bg-accent text-accent-foreground hover:bg-accent/90"
                      : "h-9 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  }
                >
                  <Phone className="mr-1.5 size-3.5" />
                  {isLive ? t("booking.join") : t("booking.start")}
                </Button>
              </Link>
            )}
            {canCancel && (
              <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                    <span className="ml-1 hidden sm:inline">{t("booking.cancel")}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("booking.cancelTitle")}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          {t("booking.cancelConfirm")
                            .replace("{name}", isExpertView ? booking.userName : booking.takumiName)
                            .replace("{date}", formatDateBerlin(new Date(booking.date + "T12:00:00Z")))}
                        </p>

                        {/* Fee preview panel */}
                        {cancelPreview && !isExpertCancelling ? (
                          cancelPreview.isFree ? (
                            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                  {t("booking.cancelFree")}
                                </p>
                                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                  {t("booking.cancelFreeDesc")
                                    .replace("{hours}", String(Math.round(cancelPreview.hoursUntilSession)))}
                                </p>
                                {booking.paymentStatus === "paid" && (
                                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                    {t("booking.fullRefund").replace(
                                      "{amount}",
                                      formatCents(cancelPreview.refundAmount)
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                  {t("booking.cancelFeeApplies")}
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  {t("booking.cancelFeeDesc")
                                    .replace("{percent}", String(cancelPreview.feePercent))
                                    .replace("{freeHours}", String(cancelPreview.freeHours))}
                                </p>
                                {booking.paymentStatus === "paid" && (
                                  <div className="mt-1.5 space-y-0.5 border-t border-amber-200 pt-1.5 dark:border-amber-800">
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                      {t("booking.feeBreakdown")
                                        .replace("{fee}", formatCents(cancelPreview.feeAmount))
                                        .replace("{refund}", formatCents(cancelPreview.refundAmount))}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        ) : isExpertCancelling ? (
                          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <div>
                              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                {t("booking.expertCancelFree")}
                              </p>
                              {booking.paymentStatus === "paid" && cancelPreview && (
                                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                  {t("booking.fullRefund").replace(
                                    "{amount}",
                                    formatCents(cancelPreview.refundAmount)
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.abort")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("booking.confirmCancel")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

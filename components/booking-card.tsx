"use client"

import { useState } from "react"
import Link from "next/link"
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
import { Video, Clock, Calendar, Phone, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
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

export function BookingCard({
  booking,
  onCancelled,
}: {
  booking: BookingRecord
  onCancelled?: () => void
}) {
  const [isCancelling, setIsCancelling] = useState(false)
  const status = statusConfig[booking.status] || statusConfig.pending
  const isLive = booking.status === "active"
  const canJoin = booking.status === "confirmed" || booking.status === "active"
  const canCancel = ["pending", "confirmed", "active"].includes(booking.status)

  async function handleCancel() {
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/bookings/${booking._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (res.ok) {
        const msg = data.refund?.refunded
          ? "Buchung storniert. Rueckerstattung wird bearbeitet."
          : "Buchung storniert."
        toast.success(msg)
        onCancelled?.()
      } else {
        toast.error(data.error || "Stornierung fehlgeschlagen.")
      }
    } catch {
      toast.error("Netzwerkfehler bei Stornierung.")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Card className="gap-0 overflow-hidden border-border/60 py-0 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        <Avatar className="size-12 shrink-0 border-2 border-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {getInitials(booking.takumiName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-foreground">
              {booking.takumiName}
            </span>
            <Badge variant="outline" className={`shrink-0 text-[10px] ${status.className}`}>
              {isLive && (
                <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
              )}
              {status.label}
            </Badge>
          </div>

          {booking.takumiSubcategory && (
            <p className="text-xs text-muted-foreground">{booking.takumiSubcategory}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(booking.date + "T00:00:00").toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "short",
              })}
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

          {/* Action buttons */}
          <div className="mt-2 flex gap-2">
            {canJoin && (
              <Link href={`/session/${booking._id}`} className="flex-1">
                <Button
                  size="sm"
                  className={
                    isLive
                      ? "h-9 w-full animate-pulse bg-accent text-accent-foreground hover:bg-accent/90"
                      : "h-9 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  }
                >
                  <Phone className="mr-1.5 size-3.5" />
                  {isLive ? "Beitreten" : "Starten"}
                </Button>
              </Link>
            )}
            {canCancel && (
              <AlertDialog>
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
                    <span className="ml-1 hidden sm:inline">Stornieren</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Buchung stornieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Moechtest du die Buchung mit {booking.takumiName} am{" "}
                      {new Date(booking.date + "T00:00:00").toLocaleDateString("de-DE")} wirklich
                      stornieren?
                      {booking.paymentStatus === "paid" && (
                        <span className="mt-2 block text-sm font-medium text-foreground">
                          Der bezahlte Betrag wird automatisch zurueckerstattet.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Ja, stornieren
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

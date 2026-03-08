"use client"

/**
 * diaiway Safety Enforcement — Admin-Ansicht für KI-Alert-Incidents (Beweissicherung)
 */

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Shield, ArrowLeft, Loader2, UserX, CheckCircle2, Ban } from "lucide-react"

interface SafetyIncidentEnriched {
  id: string
  bookingId: string
  imageUrl: string
  reason: string
  status: string
  createdAt: string
  booking: {
    id: string
    userName: string
    userEmail: string
    expertName: string
    date: string
    startTime: string
    status: string
  }
}

function relDate(iso: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return "gerade eben"
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`
  return d.toLocaleDateString("de-DE")
}

export default function AdminSafetyIncidentsPage() {
  const { data: session } = useSession()
  const user = session?.user as { role?: string } | null
  const [incidents, setIncidents] = useState<SafetyIncidentEnriched[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== "admin") return
    fetch("/api/admin/safety/incidents")
      .then((r) => r.json())
      .then((data) => setIncidents(data.incidents ?? []))
      .catch(() => toast.error("Fehler beim Laden"))
      .finally(() => setLoading(false))
  }, [user?.role])

  async function handleStatus(id: string, status: string) {
    setUpdating(id)
    try {
      const res = await fetch(`/api/admin/safety/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Fehler")
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
      toast.success("Status aktualisiert")
    } catch {
      toast.error("Aktualisierung fehlgeschlagen")
    } finally {
      setUpdating(null)
    }
  }

  if (user?.role !== "admin") {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-sm text-muted-foreground">Keine Berechtigung.</p>
          <Button asChild variant="outline">
            <Link href="/admin">Zurück zum Admin</Link>
          </Button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/admin/safety">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="size-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">KI-Alert Incidents</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Beweissicherung bei Richtlinienverstößen (LIKELY/VERY_LIKELY). Hier entscheidest du, ob Sperre dauerhaft bleibt oder Stripe-Hold freigegeben wird.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-12 text-green-500/50" />
              <p className="text-sm text-muted-foreground">Keine KI-Alert Incidents vorhanden.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin/safety">Zu Safety Reports</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {incidents.map((inc) => (
              <Card key={inc.id} className="border-border/60 overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  <Image
                    src={inc.imageUrl}
                    alt={`Alert ${inc.bookingId}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                    unoptimized
                  />
                  <Badge
                    className={`absolute right-2 top-2 ${
                      inc.status === "blocked"
                        ? "bg-destructive/90"
                        : inc.status === "refunded"
                          ? "bg-amber-600"
                          : inc.status === "resolved"
                            ? "bg-green-600"
                            : "bg-amber-600"
                    }`}
                  >
                    {inc.status}
                  </Badge>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {inc.booking?.userName} → {inc.booking?.expertName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {inc.booking?.date} · {inc.booking?.startTime} · {relDate(inc.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">{inc.reason}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {inc.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          onClick={() => handleStatus(inc.id, "blocked")}
                          disabled={!!updating}
                        >
                          {updating === inc.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <UserX className="mr-1 size-3" />
                          )}
                          Sperre
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleStatus(inc.id, "refunded")}
                          disabled={!!updating}
                        >
                          Hold freigeben
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => handleStatus(inc.id, "resolved")}
                          disabled={!!updating}
                        >
                          Erledigt
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

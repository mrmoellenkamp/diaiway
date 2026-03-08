"use client"

/**
 * diaiway Safety Enforcement — Admin-View für Safety Reports
 */

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Shield, Flag, ArrowLeft, Loader2, UserX, Check } from "lucide-react"

interface SafetyReportEnriched {
  id: string
  bookingId: string
  reporterId: string
  reportedId: string
  reporterRole: string
  reason: string | null
  details: string | null
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
  reporter?: { id: string; name: string; email: string; isBanned: boolean }
  reported?: { id: string; name: string; email: string; isBanned: boolean }
}

function relDate(iso: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return "gerade eben"
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`
  return d.toLocaleDateString("de-DE")
}

export default function AdminSafetyPage() {
  const { data: session } = useSession()
  const user = session?.user as { role?: string } | null
  const [reports, setReports] = useState<SafetyReportEnriched[]>([])
  const [loading, setLoading] = useState(true)
  const [banning, setBanning] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role !== "admin") return
    fetch("/api/admin/safety")
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .catch(() => toast.error("Fehler beim Laden"))
      .finally(() => setLoading(false))
  }, [user?.role])

  async function handleResolve(id: string) {
    try {
      const res = await fetch(`/api/admin/safety/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
      if (!res.ok) throw new Error("Fehler")
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: "resolved" } : r)))
      toast.success("Report als erledigt markiert")
    } catch {
      toast.error("Aktualisierung fehlgeschlagen")
    }
  }

  async function handleBan(reportId: string, userId: string) {
    setBanning(userId)
    try {
      const res = await fetch(`/api/admin/safety/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banUserId: userId, status: "resolved" }),
      })
      if (!res.ok) throw new Error("Fehler")
      setReports((prev) =>
        prev.map((r) => {
          if (r.id === reportId) return { ...r, status: "resolved" }
          if (r.reported?.id === userId) return { ...r, reported: r.reported ? { ...r.reported, isBanned: true } : undefined }
          if (r.reporter?.id === userId) return { ...r, reporter: r.reporter ? { ...r.reporter, isBanned: true } : undefined }
          return r
        })
      )
      toast.success("Nutzer dauerhaft gesperrt")
    } catch {
      toast.error("Sperrung fehlgeschlagen")
    } finally {
      setBanning(null)
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
            <Link href="/admin">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="size-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">diaiway Safety Enforcement</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Verwalte Safety Reports aus dem Video-Call. Bei schweren Verstößen kannst du Nutzer dauerhaft sperren (isBanned).
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Flag className="mx-auto mb-3 size-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Keine Safety Reports vorhanden.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <Card key={r.id} className="border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">
                      Buchung {r.booking?.date} · {r.booking?.startTime}
                    </CardTitle>
                    <Badge
                      className={
                        r.status === "pending"
                          ? "bg-amber-500/15 text-amber-700"
                          : "bg-green-500/15 text-green-700"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.booking?.userName} ↔ {r.booking?.expertName} · {relDate(r.createdAt)}
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Gemeldet von:</span>{" "}
                      {r.reporter?.name ?? r.reporterId} ({r.reporterRole})
                      {r.reporter?.isBanned && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">Gesperrt</Badge>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gemeldeter Nutzer:</span>{" "}
                      {r.reported?.name ?? r.reportedId} ({r.reported?.email})
                      {r.reported?.isBanned && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">Gesperrt</Badge>
                      )}
                    </div>
                    {r.reason && <div><span className="text-muted-foreground">Grund:</span> {r.reason}</div>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => handleResolve(r.id)}>
                        <Check className="mr-1 size-3.5" />
                        Erledigt
                      </Button>
                    )}
                    {r.reported && !r.reported.isBanned && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleBan(r.id, r.reported!.id)}
                        disabled={banning === r.reported!.id}
                      >
                        {banning === r.reported!.id ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <UserX className="mr-1 size-3.5" />
                        )}
                        Sperren
                      </Button>
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

"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { AppSubpageHeader } from "@/components/app-subpage-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Loader2, Search, Trash2, XCircle, RefreshCw,
  UserPlus, CheckCircle2, Clock, Euro, Link2, Filter,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// ─── Types ──────────────────────────────────────────────────────────────────

interface GuestBooking {
  id: string
  guestToken: string
  guestEmail: string
  date: string
  startTime: string
  endTime: string
  totalPrice: number | null
  paymentStatus: "unpaid" | "paid" | "refunded"
  status: string
  callType: string
  note: string | null
  createdAt: string
  expert: {
    id: string
    name: string
    email: string | null
    userId: string | null
  } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  const [y, m, day] = d.split("-")
  return `${day}.${m}.${y}`
}

function formatPrice(p: number | null) {
  if (p == null) return "–"
  return Number(p).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

function statusLabel(b: GuestBooking) {
  if (b.status === "cancelled") return { label: "Storniert", cls: "border-muted text-muted-foreground" }
  if (b.paymentStatus === "paid") return { label: "Bezahlt", cls: "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] text-emerald-600" }
  if (b.paymentStatus === "refunded") return { label: "Erstattet", cls: "border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.1)] text-blue-600" }
  return { label: "Ausstehend", cls: "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] text-amber-600" }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminGuestBookingsPage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const userRole = (session?.user as { role?: string })?.role

  useEffect(() => {
    if (authStatus === "authenticated" && userRole !== "admin") router.replace("/home")
  }, [authStatus, userRole, router])

  const [bookings, setBookings] = useState<GuestBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter })
      if (search) params.set("search", search)
      const res = await fetch(`/api/admin/guest-bookings?${params}`)
      const data = await res.json()
      setBookings(data.bookings || [])
    } catch {
      toast.error("Fehler beim Laden.")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  async function handleCancel(id: string) {
    setActionLoading(id + "-cancel")
    try {
      const res = await fetch(`/api/admin/guest-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = await res.json()
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "cancelled" } : b))
        toast.success("Buchung storniert.")
      } else {
        toast.error(data.error || "Fehler.")
      }
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id + "-delete")
    try {
      const res = await fetch(`/api/admin/guest-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      })
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== id))
        toast.success("Buchung gelöscht.")
      } else {
        const data = await res.json()
        toast.error(data.error || "Fehler.")
      }
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setActionLoading(null)
    }
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/call/${token}`
    navigator.clipboard.writeText(link).then(() => toast.success("Link kopiert!"))
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  // Stats
  const total = bookings.length
  const paid = bookings.filter((b) => b.paymentStatus === "paid").length
  const pending = bookings.filter((b) => b.paymentStatus === "unpaid" && b.status !== "cancelled").length
  const revenue = bookings
    .filter((b) => b.paymentStatus === "paid")
    .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0)

  return (
    <div className="min-h-screen bg-background pb-safe">
      <PageContainer>
        <div className="flex flex-col gap-5">

          <AppSubpageHeader
            title="Gast-Buchungen"
            subtitle="Übersicht aller Gast-Call-Einladungen · Stornieren · Löschen"
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: UserPlus, label: "Gesamt", value: total, cls: "text-primary" },
              { icon: Clock, label: "Ausstehend", value: pending, cls: "text-amber-600" },
              { icon: CheckCircle2, label: "Bezahlt", value: paid, cls: "text-emerald-600" },
              { icon: Euro, label: "Umsatz", value: revenue.toLocaleString("de-DE", { style: "currency", currency: "EUR" }), cls: "text-blue-600" },
            ].map(({ icon: Icon, label, value, cls }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className={`size-5 shrink-0 ${cls}`} />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 text-sm"
                  placeholder="Gast-E-Mail suchen…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter className="size-4 text-muted-foreground" />
                {(["all", "unpaid", "paid"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "Alle" : s === "unpaid" ? "Ausstehend" : "Bezahlt"}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={load}>
                <RefreshCw className="size-3.5" /> Aktualisieren
              </Button>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserPlus className="size-4 text-primary" />
                {bookings.length} Gast-Buchungen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bookings.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground italic">Keine Einträge gefunden.</p>
              ) : (
                <div className="divide-y divide-[rgba(231,229,227,0.5)]">
                  {bookings.map((b) => {
                    const { label, cls } = statusLabel(b)
                    const isCancelled = b.status === "cancelled"
                    const isPaid = b.paymentStatus === "paid"
                    return (
                      <div key={b.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isCancelled ? "opacity-50" : ""}`}>
                        {/* Left: info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold truncate">{b.guestEmail}</span>
                            <Badge variant="outline" className={`text-[10px] ${cls}`}>{label}</Badge>
                            <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">
                              {b.callType}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(b.date)} · {b.startTime}–{b.endTime} · {formatPrice(b.totalPrice)}
                          </p>
                          {b.expert && (
                            <p className="text-[11px] text-muted-foreground">
                              Takumi: <span className="font-medium">{b.expert.name}</span>
                              {b.expert.email ? ` · ${b.expert.email}` : ""}
                            </p>
                          )}
                          {b.note && (
                            <p className="text-[11px] italic text-muted-foreground truncate">Notiz: {b.note}</p>
                          )}
                        </div>

                        {/* Right: actions */}
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          {/* Copy link */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => copyLink(b.guestToken)}
                          >
                            <Link2 className="size-3" /> Link
                          </Button>

                          {/* Cancel (only unpaid + not already cancelled) */}
                          {!isCancelled && !isPaid && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1 text-xs border-[rgba(245,158,11,0.3)] text-amber-700 hover:bg-amber-50"
                                  disabled={actionLoading === b.id + "-cancel"}
                                >
                                  {actionLoading === b.id + "-cancel"
                                    ? <Loader2 className="size-3 animate-spin" />
                                    : <XCircle className="size-3" />
                                  }
                                  Stornieren
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Buchung stornieren?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Gast-Einladung für <strong>{b.guestEmail}</strong> am {formatDate(b.date)} wird storniert. Der Link wird ungültig.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <Button variant="destructive" onClick={() => handleCancel(b.id)}>
                                    Stornieren
                                  </Button>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {/* Delete */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 text-xs border-[rgba(239,68,68,0.3)] text-destructive hover:bg-[rgba(239,68,68,0.05)]"
                                disabled={actionLoading === b.id + "-delete"}
                              >
                                {actionLoading === b.id + "-delete"
                                  ? <Loader2 className="size-3 animate-spin" />
                                  : <Trash2 className="size-3" />
                                }
                                Löschen
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Buchung löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Diese Aktion ist unwiderruflich. Die Buchung für <strong>{b.guestEmail}</strong> wird dauerhaft gelöscht.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <Button variant="destructive" onClick={() => handleDelete(b.id)}>
                                  Dauerhaft löschen
                                </Button>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </PageContainer>
    </div>
  )
}

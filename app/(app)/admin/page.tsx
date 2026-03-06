"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useCategories } from "@/lib/categories-i18n"
import {
  Users, DollarSign, AlertTriangle, Database, Loader2, UserPlus,
  BarChart3, TrendingUp, TrendingDown, Activity, BookOpen,
  Star, Wifi, WifiOff, Shield, RefreshCw, Search, ChevronLeft,
  ChevronRight, Trash2, Edit2, Check, X, CalendarDays, CreditCard,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react"
import { ImageUpload } from "@/components/image-upload"

// ─── Types ─────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; shugyo: number; takumi: number; newThisMonth: number; newLast30Days: number }
  experts: { total: number; live: number; verified: number }
  bookings: { total: number; thisMonth: number; last7Days: number; byStatus: Record<string, number> }
  revenue: { totalCents: number; thisMonthCents: number; lastMonthCents: number; growthPct: number; paidCount: number; paidThisMonthCount: number }
  recent: {
    bookings: RecentBooking[]
    users: RecentUser[]
  }
  topExperts: TopExpert[]
}

interface RecentBooking {
  id: string; userName: string; expertName: string; date: string
  startTime: string; status: string; price: number; paymentStatus: string
  createdAt: string; cancelledBy: string | null
}

interface RecentUser {
  id: string; name: string; email: string; role: string; appRole: string; createdAt: string
}

interface TopExpert {
  id: string; name: string; categoryName: string; rating: number
  sessionCount: number; reviewCount: number; isLive: boolean; pricePerSession: number
}

interface AdminUser {
  id: string; name: string; email: string; role: string; appRole: string
  image: string; createdAt: string; _count: { bookings: number }
}

interface AdminBooking {
  id: string; userName: string; userEmail: string; expertName: string
  date: string; startTime: string; endTime: string; status: string
  price: number; paymentStatus: string; paidAmount: number | null
  stripePaymentIntentId: string | null; cancelledBy: string | null
  cancelFeeAmount: number | null; createdAt: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function eur(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    active: "bg-green-500/15 text-green-700 dark:text-green-400",
    completed: "bg-primary/15 text-primary",
    declined: "bg-red-500/15 text-red-700 dark:text-red-400",
    cancelled: "bg-muted text-muted-foreground",
    paid: "bg-green-500/15 text-green-700 dark:text-green-400",
    unpaid: "bg-muted text-muted-foreground",
    refunded: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  }
  return map[s] ?? "bg-muted text-muted-foreground"
}

function relDate(iso: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return "gerade eben"
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`
  return `vor ${Math.floor(diff / 86400)} Tagen`
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, trend, color = "primary",
}: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; trend?: number; color?: string
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${colorMap[color] ?? colorMap.primary}`}>
            <Icon className="size-5" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${trend > 0 ? "text-green-600" : trend < 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {trend > 0 ? <ArrowUpRight className="size-3.5" /> : trend < 0 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: Stats }) {
  const bs = stats.bookings.byStatus
  return (
    <div className="flex flex-col gap-5">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Nutzer gesamt" value={stats.users.total}
          sub={`+${stats.users.newThisMonth} diesen Monat`} color="blue" />
        <StatCard icon={Activity} label="Experten" value={stats.experts.total}
          sub={`${stats.experts.live} online`} color="green" />
        <StatCard icon={BookOpen} label="Buchungen" value={stats.bookings.total}
          sub={`${stats.bookings.last7Days} letzte 7 Tage`} color="purple" />
        <StatCard icon={DollarSign} label="Umsatz gesamt" value={eur(stats.revenue.totalCents)}
          sub={`${eur(stats.revenue.thisMonthCents)} diesen Monat`}
          trend={stats.revenue.growthPct} color="orange" />
      </div>

      {/* Role split */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Nutzer-Rollen</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Shugyo</span><span>{stats.users.shugyo}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-500"
                  style={{ width: `${stats.users.total ? (stats.users.shugyo / stats.users.total) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Takumi</span><span>{stats.users.takumi}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary"
                  style={{ width: `${stats.users.total ? (stats.users.takumi / stats.users.total) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking status breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Buchungen nach Status</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "pending", label: "Ausstehend" },
              { key: "confirmed", label: "Bestätigt" },
              { key: "active", label: "Aktiv" },
              { key: "completed", label: "Abgeschlossen" },
              { key: "declined", label: "Abgelehnt" },
              { key: "cancelled", label: "Storniert" },
            ].map(({ key, label }) => (
              <div key={key} className="flex flex-col items-center rounded-lg border border-border/40 bg-muted/30 p-2 text-center">
                <span className="text-lg font-bold text-foreground">{bs[key] ?? 0}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            Umsatz-Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
              <p className="text-xs text-muted-foreground">Dieser Monat</p>
              <p className="text-lg font-bold text-foreground">{eur(stats.revenue.thisMonthCents)}</p>
              <p className="text-[10px] text-muted-foreground">{stats.revenue.paidThisMonthCount} Zahlungen</p>
            </div>
            <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
              <p className="text-xs text-muted-foreground">Letzter Monat</p>
              <p className="text-lg font-bold text-foreground">{eur(stats.revenue.lastMonthCents)}</p>
              <p className="text-[10px] text-muted-foreground">Vergleichszeitraum</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
            <span className="text-sm font-medium">Gesamtumsatz</span>
            <span className="text-sm font-bold text-primary">{eur(stats.revenue.totalCents)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Top experts */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Star className="size-4 text-yellow-500" />
            Top Takumis (nach Sessions)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-2">
          {stats.topExperts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Noch keine Daten</p>
          )}
          {stats.topExperts.map((ex, i) => (
            <div key={ex.id} className="flex items-center gap-3 rounded-lg border border-border/40 p-2.5">
              <span className="text-sm font-bold text-muted-foreground w-4 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{ex.name}</span>
                  {ex.isLive && <span className="flex size-1.5 rounded-full bg-green-500" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{ex.categoryName}</span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold">{ex.sessionCount} Sessions</p>
                <p className="text-[10px] text-muted-foreground">⭐ {ex.rating.toFixed(1)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Letzte Aktivität</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-2">
          {stats.recent.bookings.map((b) => (
            <div key={b.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">
                  {b.userName} → {b.expertName}
                </p>
                <p className="text-[11px] text-muted-foreground">{b.date} · {b.startTime}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(b.status)}`}>{b.status}</span>
                <span className="text-[10px] text-muted-foreground">{relDate(b.createdAt)}</span>
              </div>
            </div>
          ))}
          {stats.recent.bookings.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Noch keine Buchungen</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ role: string; appRole: string }>({ role: "", appRole: "" })
  const [saving, setSaving] = useState(false)
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q) params.set("q", q)
      if (filterRole) params.set("appRole", filterRole)
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, q, filterRole])

  useEffect(() => { void load() }, [load])

  async function handleSave(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        toast.success("Gespeichert")
        setEditingId(null)
        void load()
      } else {
        toast.error("Fehler beim Speichern")
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Nutzer „${name}" wirklich löschen? Diese Aktion ist unwiderruflich.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Nutzer gelöscht"); void load() }
    else toast.error("Fehler beim Löschen")
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Name oder E-Mail suchen…" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            className="pl-9 h-9 text-sm" />
        </div>
        <select value={filterRole} onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[110px]">
          <option value="">Alle Rollen</option>
          <option value="shugyo">Shugyo</option>
          <option value="takumi">Takumi</option>
        </select>
      </div>

      <div className="text-xs text-muted-foreground">{total} Nutzer gefunden</div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && users.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Keine Nutzer gefunden</p>
      )}

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <Card key={u.id} className="border-border/50">
            <CardContent className="p-3">
              {editingId === u.id ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] mb-1 block">System-Rolle</Label>
                      <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[11px] mb-1 block">App-Rolle</Label>
                      <select value={editForm.appRole} onChange={(e) => setEditForm({ ...editForm, appRole: e.target.value })}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
                        <option value="shugyo">Shugyo</option>
                        <option value="takumi">Takumi</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => handleSave(u.id)} disabled={saving}>
                      {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Speichern
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => setEditingId(null)}>
                      <X className="size-3" /> Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {u.image ? (
                      <img src={u.image} alt={u.name} className="size-full rounded-full object-cover" />
                    ) : u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{u.name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${u.appRole === "takumi" ? "bg-primary/15 text-primary" : "bg-blue-500/15 text-blue-600"}`}>
                        {u.appRole}
                      </span>
                      {u.role === "admin" && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-600">
                          admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    <p className="text-[10px] text-muted-foreground">{u._count.bookings} Buchungen · {relDate(u.createdAt)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="size-7"
                      onClick={() => { setEditingId(u.id); setEditForm({ role: u.role, appRole: u.appRole }) }}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(u.id, u.name)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button size="icon" variant="outline" className="size-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button size="icon" variant="outline" className="size-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function BookingsTab() {
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q) params.set("q", q)
      if (filterStatus) params.set("status", filterStatus)
      const res = await fetch(`/api/admin/bookings?${params}`)
      const data = await res.json()
      setBookings(data.bookings ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, q, filterStatus])

  useEffect(() => { void load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Nutzer oder Experte…" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            className="pl-9 h-9 text-sm" />
        </div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]">
          <option value="">Alle Status</option>
          {["pending","confirmed","active","completed","declined","cancelled"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-muted-foreground">{total} Buchungen</div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>}

      <div className="flex flex-col gap-2">
        {bookings.map((b) => (
          <Card key={b.id} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(b.status)}`}>{b.status}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(b.paymentStatus)}`}>{b.paymentStatus}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{b.userName}</p>
                  <p className="text-xs text-muted-foreground">→ {b.expertName}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{b.date} · {b.startTime}–{b.endTime}</p>
                  {b.cancelledBy && (
                    <p className="text-[11px] text-red-500 mt-0.5">Storniert durch: {b.cancelledBy}
                      {b.cancelFeeAmount ? ` · Gebühr: ${eur(b.cancelFeeAmount)}` : ""}</p>
                  )}
                  {b.stripePaymentIntentId && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                      Stripe: {b.stripePaymentIntentId}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{eur(b.price * 100)}</p>
                  {b.paidAmount && <p className="text-[10px] text-green-600">Bezahlt: {eur(b.paidAmount)}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && bookings.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Keine Buchungen gefunden</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button size="icon" variant="outline" className="size-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button size="icon" variant="outline" className="size-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function TakumisTab() {
  const [takumis, setTakumis] = useState<TopExpert[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/takumis")
      const data = await res.json()
      setTakumis(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function toggleLive(id: string, current: boolean) {
    setToggling(id)
    try {
      const res = await fetch(`/api/takumis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isLive: !current }),
      })
      if (res.ok) { void load() }
      else toast.error("Fehler beim Aktualisieren")
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>}
      {takumis.map((ex) => (
        <Card key={ex.id} className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{ex.name}</span>
                  {ex.isLive
                    ? <Wifi className="size-3.5 text-green-500 shrink-0" />
                    : <WifiOff className="size-3.5 text-muted-foreground shrink-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground">{ex.categoryName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  ⭐ {ex.rating.toFixed(1)} · {ex.sessionCount} Sessions · {ex.pricePerSession}€/30 Min
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {toggling === ex.id
                  ? <Loader2 className="size-4 animate-spin text-primary" />
                  : <Switch checked={ex.isLive} onCheckedChange={() => toggleLive(ex.id, ex.isLive)} />}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {!loading && takumis.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Keine Takumis gefunden</p>
      )}
    </div>
  )
}

function DatabaseTab({
  categories,
}: {
  categories: ReturnType<typeof useCategories>
}) {
  const [isSeeding, setIsSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({
    name: "", email: "", categorySlug: "elektronik", subcategory: "",
    bio: "", pricePerSession: "49", imageUrl: "", isLive: false,
  })

  async function handleAddExpert(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.subcategory || !form.bio) { toast.error("Bitte alle Pflichtfelder ausfüllen."); return }
    setIsAdding(true)
    const cat = categories.find((c) => c.slug === form.categorySlug)
    try {
      const res = await fetch("/api/takumis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryName: cat?.name ?? form.categorySlug, pricePerSession: Number(form.pricePerSession) }),
      })
      const data = await res.json()
      if (res.ok) { toast.success(data.message); setForm({ name: "", email: "", categorySlug: "elektronik", subcategory: "", bio: "", pricePerSession: "49", imageUrl: "", isLive: false }) }
      else toast.error(data.error)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Netzwerkfehler") }
    finally { setIsAdding(false) }
  }

  async function handleSeed() {
    setIsSeeding(true); setSeedResult(null)
    try {
      const res = await fetch("/api/takumis/seed", { method: "POST" })
      const data = await res.json()
      if (res.ok) { setSeedResult(`${data.count} Experten erfolgreich geschrieben.`); toast.success(data.message) }
      else { setSeedResult(`Fehler: ${data.error}`); toast.error(data.error) }
    } catch (err) { const msg = err instanceof Error ? err.message : "Netzwerkfehler"; setSeedResult(`Fehler: ${msg}`); toast.error(msg) }
    finally { setIsSeeding(false) }
  }

  async function handleReset() {
    if (!confirm("ACHTUNG: Alle Daten (Nutzer, Experten, Buchungen) werden unwiderruflich gelöscht. Fortfahren?")) return
    setIsResetting(true)
    try {
      const res = await fetch("/api/admin/reset-db", { method: "POST" })
      const data = await res.json()
      if (res.ok) { toast.success(data.message); setSeedResult(null) }
      else toast.error(data.error)
    } catch { toast.error("Netzwerkfehler") }
    finally { setIsResetting(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="size-4 text-primary" />
            Datenbank-Operationen
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Test-Experten in die PostgreSQL-Datenbank schreiben. Bestehende Seed-Experten werden überschrieben.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSeed} disabled={isSeeding || isResetting} className="h-10 flex-1 gap-2">
              {isSeeding ? <><Loader2 className="size-4 animate-spin" /> Schreibe…</> : <><Database className="size-4" /> Experten seeden</>}
            </Button>
            <Button onClick={handleReset} disabled={isResetting || isSeeding} variant="destructive" className="h-10 flex-1 gap-2">
              {isResetting ? <><Loader2 className="size-4 animate-spin" /> Lösche…</> : <><AlertTriangle className="size-4" /> DB zurücksetzen</>}
            </Button>
          </div>
          {seedResult && <p className={`text-xs font-medium ${seedResult.startsWith("Fehler") ? "text-destructive" : "text-green-600"}`}>{seedResult}</p>}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserPlus className="size-4 text-primary" />
            Neuen Takumi hinzufügen
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <form onSubmit={handleAddExpert} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Name *</Label>
                <Input placeholder="Hans Meier" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">E-Mail</Label>
                <Input type="email" placeholder="expert@domain.de" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Kategorie *</Label>
                <select value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Fachgebiet *</Label>
                <Input placeholder="z.B. Smartphone-Reparatur" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Kurzbio *</Label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3}
                placeholder="Erfahrung, Qualifikationen…"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Preis / 30 Min (€)</Label>
                <Input type="number" min={1} value={form.pricePerSession} onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })} className="h-9 text-sm" />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch id="live-new" checked={form.isLive} onCheckedChange={(v) => setForm({ ...form, isLive: v })} />
                  <Label htmlFor="live-new" className="text-xs">Sofort live</Label>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Profilbild</Label>
              <ImageUpload value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} folder="experts" variant="card" />
            </div>
            <Button type="submit" disabled={isAdding} className="h-10 gap-2">
              {isAdding ? <><Loader2 className="size-4 animate-spin" /> Speichert…</> : <><UserPlus className="size-4" /> Takumi speichern</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session } = useSession()
  const categories = useCategories()
  const adminName = session?.user?.name || "Admin"

  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  async function loadStats() {
    setStatsLoading(true)
    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) setStats(await res.json())
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => { void loadStats() }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageContainer>
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">Admin-Dashboard</h1>
                <Badge className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]" variant="outline">
                  Admin
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Shield className="inline size-3 mr-1" />
                {adminName}
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={loadStats} disabled={statsLoading}>
              <RefreshCw className={`size-3.5 ${statsLoading ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>

          {/* Quick-KPI bar (always visible) */}
          {stats && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Nutzer", value: stats.users.total, icon: Users, color: "text-blue-500" },
                { label: "Takumis", value: stats.experts.live + "/" + stats.experts.total, icon: Activity, color: "text-green-500" },
                { label: "Buchungen", value: stats.bookings.total, icon: CalendarDays, color: "text-purple-500" },
                { label: "Umsatz", value: eur(stats.revenue.totalCents), icon: DollarSign, color: "text-orange-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex flex-col items-center rounded-xl border border-border/50 bg-card p-2 text-center">
                  <Icon className={`size-4 ${color} mb-1`} />
                  <span className="text-sm font-bold text-foreground leading-tight">{value}</span>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 h-9">
              <TabsTrigger value="overview" className="text-xs"><BarChart3 className="size-3.5 mr-1" />Übersicht</TabsTrigger>
              <TabsTrigger value="users" className="text-xs"><Users className="size-3.5 mr-1" />Nutzer</TabsTrigger>
              <TabsTrigger value="bookings" className="text-xs"><CalendarDays className="size-3.5 mr-1" />Buchungen</TabsTrigger>
              <TabsTrigger value="takumis" className="text-xs"><Star className="size-3.5 mr-1" />Takumis</TabsTrigger>
              <TabsTrigger value="database" className="text-xs"><Database className="size-3.5 mr-1" />DB</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              {statsLoading && <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>}
              {!statsLoading && stats && <OverviewTab stats={stats} />}
              {!statsLoading && !stats && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-muted-foreground">Statistiken konnten nicht geladen werden.</p>
                  <Button size="sm" onClick={loadStats}>Erneut versuchen</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <UsersTab />
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">
              <BookingsTab />
            </TabsContent>

            <TabsContent value="takumis" className="mt-4">
              <TakumisTab />
            </TabsContent>

            <TabsContent value="database" className="mt-4">
              <DatabaseTab categories={categories} />
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>
    </div>
  )
}

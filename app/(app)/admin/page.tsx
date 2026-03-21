"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
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
import { useI18n } from "@/lib/i18n"
import { useCategories } from "@/lib/categories-i18n"
import {
  Users, Euro, AlertTriangle, Database, Loader2, UserPlus,
  BarChart3, Activity, BookOpen,
  Star, Wifi, WifiOff, Shield, RefreshCw, Search, ChevronLeft,
  ChevronRight, Trash2, Edit2, Check, X, CalendarDays, CreditCard,
  ArrowUpRight, ArrowDownRight, Minus, Lock, FileArchive, FileText,
  Mail, Building2, User as UserIcon, ExternalLink, CheckCircle2, XCircle, FolderOpen, Send,
  Scan,
  Tags,
  Newspaper,
  LineChart,
} from "lucide-react"
import { AdminAnalyticsTab } from "@/components/admin/admin-analytics-tab"
import { ImageUpload } from "@/components/image-upload"
import { AdminUserProfileSheet } from "@/components/admin-user-profile-sheet"
import { VisionScannerTab } from "@/components/admin/vision-scanner-tab"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Types ─────────────────────────────────────────────────────────────────

interface Stats {
  degraded?: boolean
  degradedReason?: string
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
  id: string; userId?: string; expertId?: string; userName: string; expertName: string; date: string
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
  id: string; name: string; username: string | null; email: string; role: string; appRole: string
  image: string; createdAt: string; _count: { bookings: number }
}

interface AdminBooking {
  id: string; userId?: string; expertId?: string; userName: string; userEmail: string; expertName: string
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
      {stats.degraded && stats.degradedReason && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <span className="font-semibold">Statistiken eingeschränkt. </span>
          {stats.degradedReason}
        </div>
      )}
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Nutzer gesamt" value={stats.users.total}
          sub={`+${stats.users.newThisMonth} diesen Monat`} color="blue" />
        <StatCard icon={Activity} label="Experten" value={stats.experts.total}
          sub={`${stats.experts.live} online`} color="green" />
        <StatCard icon={BookOpen} label="Buchungen" value={stats.bookings.total}
          sub={`${stats.bookings.last7Days} letzte 7 Tage`} color="purple" />
        <StatCard icon={Euro} label="Umsatz gesamt" value={eur(stats.revenue.totalCents)}
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
                  {b.userId ? (
                    <Link href={`/user/${b.userId}`} className="underline-offset-2 hover:underline">{b.userName}</Link>
                  ) : (
                    b.userName
                  )}{" "}
                  →{" "}
                  {b.expertId ? (
                    <Link href={`/takumi/${b.expertId}`} className="underline-offset-2 hover:underline">{b.expertName}</Link>
                  ) : (
                    b.expertName
                  )}
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

function UsersTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ role: string; appRole: string }>({ role: "", appRole: "" })
  const [saving, setSaving] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [profileUserName, setProfileUserName] = useState("")
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
        toast.success(t("toast.saved"))
        setEditingId(null)
        onDataChanged?.()
        void load()
      } else {
        toast.error(t("toast.saveError"))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Nutzer „${name}" wirklich löschen? Persönliche Daten werden anonymisiert, Buchungs- und Wallet-Historie bleibt erhalten.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success(t("toast.userAnonymized"))
      void load()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t("toast.saveError"))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Name, Username oder E-Mail suchen…" value={q}
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
        {users.map((u) => {
          const displayName = u.username ?? u.name
          return (
          <Card key={u.id} className="border-border/50">
            <CardContent className="p-3">
              {editingId === u.id ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{displayName}</p>
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
                      <Image
                        src={u.image}
                        alt={displayName}
                        width={36}
                        height={36}
                        unoptimized
                        className="size-full rounded-full object-cover"
                      />
                    ) : displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{displayName}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${u.appRole === "takumi" ? "bg-primary/15 text-primary" : "bg-blue-500/15 text-blue-600"}`}>
                        {u.appRole}
                      </span>
                      {u.role === "admin" && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-600">
                          admin
                        </span>
                      )}
                      {u.email?.endsWith("@anonymized.local") && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                          Anonymisiert
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    <p className="text-[10px] text-muted-foreground">{u._count.bookings} Buchungen · {relDate(u.createdAt)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Vollständiges Profil anzeigen & bearbeiten"
                      onClick={() => { setProfileUserId(u.id); setProfileUserName(displayName) }}
                    >
                      <FolderOpen className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7"
                      onClick={(e) => { e.stopPropagation(); setEditingId(u.id); setEditForm({ role: u.role, appRole: u.appRole }) }}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    {!u.email?.endsWith("@anonymized.local") && u.role !== "admin" && (
                      <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(u.id, displayName) }}
                        title="Nutzer anonymisieren (DSGVO)">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})}
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

      <AdminUserProfileSheet
        userId={profileUserId}
        userName={profileUserName}
        onClose={() => setProfileUserId(null)}
        onSaved={() => { onDataChanged?.(); void load() }}
      />
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
                  <p className="text-sm font-semibold text-foreground">
                    {b.userId ? (
                      <Link href={`/user/${b.userId}`} className="underline-offset-2 hover:underline">{b.userName}</Link>
                    ) : (
                      b.userName
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    →{" "}
                    {b.expertId ? (
                      <Link href={`/takumi/${b.expertId}`} className="underline-offset-2 hover:underline">{b.expertName}</Link>
                    ) : (
                      b.expertName
                    )}
                  </p>
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

function TakumisTab({ refreshKey }: { refreshKey?: number }) {
  const { t } = useI18n()
  const [takumis, setTakumis] = useState<TopExpert[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/takumis")
      const data = await res.json()
      setTakumis(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, refreshKey])

  async function toggleLive(id: string, current: boolean) {
    setToggling(id)
    try {
      const res = await fetch(`/api/takumis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isLive: !current }),
      })
      if (res.ok) { void load() }
      else toast.error(t("toast.updateFailed"))
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
  const { t } = useI18n()
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
    if (!form.name || !form.subcategory || !form.bio) { toast.error(t("toast.pleaseFillRequired")); return }
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
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.networkError")) }
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

  const [resetPassword, setResetPassword] = useState("")
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const RESET_PHRASE = "ALLE DATEN LÖSCHEN"

  async function handleReset() {
    if (resetPassword !== RESET_PHRASE) {
      toast.error(`Bitte genau eingeben: ${RESET_PHRASE}`)
      return
    }
    setIsResetting(true)
    setResetDialogOpen(false)
    setResetPassword("")
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

            {/* Reset — protected by explicit phrase confirmation */}
            <AlertDialog open={resetDialogOpen} onOpenChange={(o) => { setResetDialogOpen(o); if (!o) setResetPassword("") }}>
              <AlertDialogTrigger asChild>
                <Button disabled={isResetting || isSeeding} variant="destructive" className="h-10 flex-1 gap-2">
                  {isResetting
                    ? <><Loader2 className="size-4 animate-spin" /> Lösche…</>
                    : <><AlertTriangle className="size-4" /> DB zurücksetzen</>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <Lock className="size-5" />
                    Datenbank unwiderruflich löschen?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-relaxed space-y-3">
                    <span className="block">
                      Diese Aktion löscht <strong>alle Nutzer, Experten und Buchungen</strong> aus der Datenbank.
                      Sie kann <strong>nicht rückgängig gemacht</strong> werden.
                    </span>
                    <span className="block font-medium text-foreground">
                      Zur Bestätigung genau eingeben:
                    </span>
                    <code className="block rounded bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive text-center tracking-wide">
                      ALLE DATEN LÖSCHEN
                    </code>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="ALLE DATEN LÖSCHEN"
                  className="font-mono text-sm border-destructive/40 focus-visible:ring-destructive"
                  onPaste={(e) => e.preventDefault()}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setResetPassword("")}>Abbrechen</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={resetPassword !== RESET_PHRASE || isResetting}
                    onClick={handleReset}
                    className="gap-2"
                  >
                    {isResetting ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
                    Endgültig löschen
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="expert@domain.de" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
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
                className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                autoCorrect="on"
                spellCheck={true} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Preis / 30 Min (€)</Label>
                <Input type="number" inputMode="decimal" min={1} value={form.pricePerSession} onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })} className="h-9 text-sm" />
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

// ─── Finance Tab ───────────────────────────────────────────────────────────

type FinanceItem = {
  id: string
  bookingId: string
  status: string
  totalAmount: number
  platformFee: number
  netPayout: number
  invoiceNumber: string | null
  creditNoteNumber: string | null
  invoicePdfUrl: string | null
  creditNotePdfUrl: string | null
  stornoInvoicePdfUrl: string | null
  stornoCreditNotePdfUrl: string | null
  completedAt: string | null
  invoiceEmailSentAt: string | null
  creditNoteEmailSentAt: string | null
  createdAt: string
  userName: string
  userEmail: string
  expertName: string
  expertEmail: string | null
  date: string
  vatId: string | null
  isBusiness: boolean
  paidAt: string | null
  sessionStartedAt: string | null
  sessionEndedAt: string | null
}

const REFUND_MAX_AGE_DAYS = 180

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
}

function isRefundDisabled(tx: FinanceItem): boolean {
  if (tx.status !== "CAPTURED") return true
  const refDate = tx.completedAt || tx.createdAt
  if (!refDate) return false
  const days = (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24)
  return days > REFUND_MAX_AGE_DAYS
}

function buildMoneyFlowTimeline(tx: FinanceItem): { time: string; label: string; detail: string }[] {
  const ev: { ts: number; label: string; detail: string }[] = []
  if (tx.paidAt) ev.push({ ts: new Date(tx.paidAt).getTime(), label: "Zahlung autorisiert", detail: "Stripe: PaymentIntent erstellt" })
  if (tx.sessionStartedAt) ev.push({ ts: new Date(tx.sessionStartedAt).getTime(), label: "Session gestartet", detail: "Daily: Teilnehmer beigetreten" })
  if (tx.sessionEndedAt) ev.push({ ts: new Date(tx.sessionEndedAt).getTime(), label: "Session beendet", detail: "Daily: Alle Teilnehmer raus" })
  if (tx.completedAt) ev.push({ ts: new Date(tx.completedAt).getTime(), label: "Abschluss verarbeitet", detail: `Rechnung ${tx.invoiceNumber ?? "—"} generiert & versendet` })
  if (tx.creditNoteEmailSentAt) {
    ev.push({ ts: new Date(tx.creditNoteEmailSentAt).getTime(), label: "Gutschrift erstellt", detail: `Gutschrift ${tx.creditNoteNumber ?? "—"} an Takumi generiert` })
  } else if (tx.completedAt && tx.creditNoteNumber) {
    ev.push({ ts: new Date(tx.completedAt).getTime(), label: "Gutschrift erstellt", detail: `Gutschrift ${tx.creditNoteNumber} an Takumi` })
  }
  ev.sort((a, b) => a.ts - b.ts)
  return ev.map((e) => ({ time: formatTime(new Date(e.ts).toISOString()), label: e.label, detail: e.detail }))
}

const MAX_EXPORT_DAYS = 93

type PendingRelease = {
  id: string
  bookingId: string
  totalAmount: number
  platformFee: number
  netPayout: number
  status: string
  createdAt: string | null
  userName: string | null
  userEmail: string | null
  expertName: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  sessionEndedAt: string | null
  stripePaymentIntentId: string | null
}

type HoldItem = {
  bookingId: string
  transactionId: string
  shugyoName: string
  shugyoUserId: string
  takumiName: string
  takumiExpertId: string
  amountCents: number
  authDate: string | null
  daysUntilExpiry: number | null
  expiryStatus: "ok" | "warning" | "critical"
  paymentType: "stripe" | "wallet"
  bookingStatus: string
  sessionEndedAt: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
}

const HOLD_CONFIRM_PHRASE = "BESTÄTIGEN"

function FinanceTab() {
  const { t } = useI18n()
  const [data, setData] = useState<{
    kpis: {
      totalPlatformFeeCents: number
      stripeFeeCents?: number
      netPlatformFeeAfterStripeCents?: number
      collectedVatCents: number
      openTakumiPayoutsCents: number
    }
    transactions: FinanceItem[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [taxFilter, setTaxFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [selected, setSelected] = useState<FinanceItem | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [exporting, setExporting] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false)
  const [refundTarget, setRefundTarget] = useState<FinanceItem | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [pendingReleases, setPendingReleases] = useState<PendingRelease[]>([])
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [holds, setHolds] = useState<HoldItem[]>([])
  const [holdsLoading, setHoldsLoading] = useState(false)
  const [holdAction, setHoldAction] = useState<"force_capture" | "manual_release" | null>(null)
  const [holdTarget, setHoldTarget] = useState<HoldItem | null>(null)
  const [holdConfirmPhrase, setHoldConfirmPhrase] = useState("")
  const [holdActioning, setHoldActioning] = useState(false)

  const loadPendingReleases = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/finance/pending-releases")
      const json = await res.json()
      if (res.ok && Array.isArray(json.items)) setPendingReleases(json.items)
      else setPendingReleases([])
    } catch { setPendingReleases([]) }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (taxFilter) params.set("tax", taxFilter)
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/admin/finance?${params}`)
      const json = await res.json()
      if (res.ok) setData(json)
      else toast.error(json.error ?? t("toast.loadError"))
    } finally {
      setLoading(false)
    }
  }, [taxFilter, statusFilter, t])

  const loadHolds = useCallback(async () => {
    setHoldsLoading(true)
    try {
      const res = await fetch("/api/admin/finance/summary")
      const json = await res.json()
      if (res.ok && Array.isArray(json.holds)) setHolds(json.holds)
      else setHolds([])
    } catch { setHolds([]) }
    finally { setHoldsLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadPendingReleases() }, [loadPendingReleases])
  useEffect(() => { void loadHolds() }, [loadHolds])

  function openHoldAction(type: "force_capture" | "manual_release", target: HoldItem) {
    setHoldAction(type)
    setHoldTarget(target)
    setHoldConfirmPhrase("")
  }

  function closeHoldAction() {
    setHoldAction(null)
    setHoldTarget(null)
    setHoldConfirmPhrase("")
  }

  async function executeHoldAction() {
    if (!holdTarget || !holdAction || holdConfirmPhrase !== HOLD_CONFIRM_PHRASE) return
    setHoldActioning(true)
    try {
      const path = holdAction === "force_capture" ? "/api/admin/finance/force-capture" : "/api/admin/finance/manual-release"
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: holdTarget.bookingId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message ?? "Aktion durchgeführt.")
        closeHoldAction()
        void load()
        void loadPendingReleases()
        void loadHolds()
      } else {
        toast.error(data.error ?? "Aktion fehlgeschlagen.")
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setHoldActioning(false)
    }
  }

  async function handleProcessRelease(item: PendingRelease) {
    if (!item.bookingId) return
    setReleasingId(item.id)
    try {
      const res = await fetch("/api/admin/finance/process-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: item.bookingId }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message ?? t("admin.captureDone"))
        void load()
        void loadPendingReleases()
        void loadHolds()
      } else {
        toast.error(json.error ?? t("toast.releaseFailed"))
      }
    } catch { toast.error(t("toast.releaseFailed")) }
    finally { setReleasingId(null) }
  }

  function exportDays(): number {
    if (!exportFrom || !exportTo) return 0
    const from = new Date(exportFrom)
    const to = new Date(exportTo)
    return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  }

  async function handleExport(type: "zip" | "datev" | "csv") {
    if (!exportFrom || !exportTo) { toast.error(t("toast.enterTimeRange")); return }
    const days = exportDays()
    if (days > MAX_EXPORT_DAYS) {
      toast.error(`Maximal ${MAX_EXPORT_DAYS} Tage (ca. 3 Monate) pro Export.`)
      return
    }
    setExporting(true)
    try {
      const path = type === "zip" ? "/api/admin/finance/export" : type === "csv" ? "/api/admin/finance/export" : "/api/admin/finance/datev"
      const url = type === "csv" ? `${path}?from=${exportFrom}&to=${exportTo}&format=csv` : `${path}?from=${exportFrom}&to=${exportTo}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? t("toast.exportFailed"))
        return
      }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = type === "zip"
        ? `diaiway_finance_${exportFrom}_${exportTo}.zip`
        : type === "csv"
          ? `diaiway_export_${exportFrom}_${exportTo}.csv`
          : `diaiway_datev_${exportFrom}_${exportTo}.csv`
      a.click()
      URL.revokeObjectURL(blobUrl)
      setExportDialogOpen(false)
      toast.success(type === "zip" ? "ZIP heruntergeladen." : type === "csv" ? "Financial CSV heruntergeladen." : "DATEV-CSV heruntergeladen.")
    } catch { toast.error(t("toast.exportFailed")) }
    finally { setExporting(false) }
  }

  function openRefundConfirm(tx: FinanceItem) {
    setRefundTarget(tx)
    setRefundConfirmOpen(true)
  }

  async function handleResendInvoice(tx: FinanceItem) {
    setResendingId(tx.id)
    try {
      const res = await fetch("/api/admin/finance/resend-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: tx.id, type: "both" }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        void load()
      } else {
        toast.error(json.results?.invoice?.error ?? json.results?.credit?.error ?? json.error ?? t("common.error"))
      }
    } catch { toast.error(t("toast.emailFailed")) }
    finally { setResendingId(null) }
  }

  async function handleRefundConfirm() {
    if (!refundTarget) return
    setRefunding(true)
    try {
      const res = await fetch("/api/admin/finance/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: refundTarget.id }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message)
        setSelected(null)
        setRefundConfirmOpen(false)
        setRefundTarget(null)
        void load()
      } else toast.error(json.error ?? t("toast.releaseFailed"))
    } finally {
      setRefunding(false)
    }
  }

  const kpis = data?.kpis
  const items = data?.transactions ?? []

  const canForceCapture = (h: HoldItem) => h.bookingStatus === "completed" && h.sessionEndedAt

  return (
    <div className="flex flex-col gap-4">
      {/* Alle Pending-Umsätze (Escrow) */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Lock className="size-4 text-amber-600" />
            Pending-Umsätze ({holds.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Alle noch nicht freigegebenen Beträge. Takumi freigeben (Force Capture) oder Shugyo zurückerstatten / Stripe-Hold auflösen (Manual Release).
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {holdsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : holds.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground text-center">Keine pending Umsätze.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
              {holds.map((h) => (
                <div
                  key={h.bookingId}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    h.expiryStatus === "critical" ? "border-red-500/40 bg-red-500/5" :
                    h.expiryStatus === "warning" ? "border-amber-500/30 bg-amber-500/5" :
                    "border-amber-500/20 bg-card"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      <Link href={`/user/${h.shugyoUserId}`} className="text-primary hover:underline">{h.shugyoName}</Link>
                      {" → "}
                      <Link href={`/takumi/${h.takumiExpertId}`} className="text-primary hover:underline">{h.takumiName}</Link>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {h.date ?? "—"} · {h.startTime ?? "—"}–{h.endTime ?? "—"}
                      {h.sessionEndedAt && <> · Ende: {new Date(h.sessionEndedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</>}
                      {" · "}
                      <Badge variant="outline" className="text-[10px]">{h.paymentType}</Badge>
                      {h.bookingStatus && <span className="ml-1">· {h.bookingStatus}</span>}
                      {h.paymentType === "stripe" && h.daysUntilExpiry != null && (
                        <span className={h.expiryStatus === "critical" ? " text-red-600 font-medium ml-1" : h.expiryStatus === "warning" ? " text-amber-600 ml-1" : " text-muted-foreground ml-1"}>
                          · {h.daysUntilExpiry}d
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold">{eur(h.amountCents)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => openHoldAction("force_capture", h)}
                      disabled={!canForceCapture(h)}
                      title={canForceCapture(h) ? "An Takumi freigeben (Rechnung + Gutschrift)" : "Nur bei abgeschlossener Session"}
                    >
                      <CheckCircle2 className="size-3" />
                      An Takumi
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                      onClick={() => openHoldAction("manual_release", h)}
                      title="Shugyo zurückerstatten / Stripe-Hold auflösen"
                    >
                      <XCircle className="size-3" />
                      An Shugyo
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offene Freigaben (Admin-Override) */}
      {pendingReleases.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lock className="size-4 text-amber-600" />
              Offene Freigaben ({pendingReleases.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Abgeschlossene Sessions, bei denen der Shugyo noch nicht freigegeben hat. Admin kann als Override freigeben (Rechnung + E-Mail werden erstellt).
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col gap-2">
              {pendingReleases.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.userName} → {item.expertName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.date} · {item.startTime}–{item.endTime}
                      {item.sessionEndedAt && (
                        <> · Ende: {new Date(item.sessionEndedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</>
                      )}
                    </p>
                    {item.stripePaymentIntentId && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.stripePaymentIntentId}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold">{eur(item.totalAmount)}</span>
                    <Button
                      size="sm"
                      className="gap-1.5 h-8"
                      onClick={() => handleProcessRelease(item)}
                      disabled={releasingId === item.id}
                    >
                      {releasingId === item.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      Freigeben
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <select value={taxFilter} onChange={(e) => setTaxFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]">
            <option value="">Alle Steuer-Status</option>
            <option value="privat">Privat</option>
            <option value="unternehmen">Business</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]">
            <option value="">Alle Status</option>
            <option value="CAPTURED">Abgeschlossen</option>
            <option value="REFUNDED">Storniert</option>
            <option value="AUTHORIZED">Reserviert</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setExportDialogOpen(true)}>
            <FileArchive className="size-4" />
            Export ZIP / CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground font-medium">Netto-Provision (Total)</p>
              <p className="text-xl font-bold text-foreground">
                {eur(kpis.netPlatformFeeAfterStripeCents ?? kpis.totalPlatformFeeCents)}
              </p>
              {kpis.stripeFeeCents != null && kpis.stripeFeeCents > 0 && (
                <p className="text-[10px] mt-0.5">
                  <span className="text-muted-foreground">Brutto {eur(kpis.totalPlatformFeeCents)}</span>
                  {" · "}
                  <span className="text-destructive font-medium">Stripe −{eur(kpis.stripeFeeCents)}</span>
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground font-medium">Gesammelte USt (Schätzung)</p>
              <p className="text-xl font-bold text-foreground">{eur(kpis.collectedVatCents)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Nur B2C, reverse charge = 0</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground font-medium">Offene Takumi-Auszahlungen</p>
              <p className="text-xl font-bold text-foreground">{eur(kpis.openTakumiPayoutsCents)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[115px]">Datum & Zeit</TableHead>
                <TableHead>Shugyo / Experte</TableHead>
                <TableHead>Beleg</TableHead>
                <TableHead>Steuer</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="text-xs whitespace-nowrap">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : row.date}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <p className="font-medium truncate max-w-[140px]">{row.userName}</p>
                      <p className="text-muted-foreground truncate max-w-[140px]">→ {row.expertName}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.invoiceNumber && <span className="font-mono">{row.invoiceNumber}</span>}
                  </TableCell>
                  <TableCell>
                    {row.isBusiness ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] gap-0.5 bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400 cursor-help">
                              <Building2 className="size-3" />
                              ZUGFeRD
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Valide ZUGFeRD 2.2 XML eingebettet</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-0.5 bg-muted text-muted-foreground">
                        <UserIcon className="size-3" />
                        Privat
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">{eur(row.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "CAPTURED" ? "default" : "secondary"} className="text-[10px]">
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {items.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">Keine Transaktionen</div>
          )}
        </Card>
      )}

      {/* Transaction Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Transaktion {selected.invoiceNumber ?? selected.id}</SheetTitle>
                <p className="text-xs text-muted-foreground">{selected.date} · {selected.userName} → {selected.expertName}</p>
              </SheetHeader>
              <div className="flex flex-col gap-4 py-4">
                {/* Geldfluss-Timeline */}
                <div>
                  <Label className="text-xs text-muted-foreground">Geldfluss-Timeline</Label>
                  <div className="mt-2 space-y-2">
                    {buildMoneyFlowTimeline(selected).length > 0 ? (
                      buildMoneyFlowTimeline(selected).map((e, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="shrink-0 font-mono text-muted-foreground w-10">{e.time}</span>
                          <div>
                            <p className="font-medium text-foreground">{e.label}</p>
                            <p className="text-muted-foreground">{e.detail}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">Noch keine Ereignisse erfasst.</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">USt-IdNr. (Shugyo)</Label>
                  <p className="text-sm font-medium">{selected.vatId || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">PDF-Links</Label>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {selected.invoicePdfUrl && (
                      <a href={selected.invoicePdfUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <FileText className="size-3.5" />
                        Rechnung öffnen
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    {selected.creditNotePdfUrl && (
                      <a href={selected.creditNotePdfUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <FileText className="size-3.5" />
                        Gutschrift öffnen
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    {selected.stornoInvoicePdfUrl && (
                      <a href={selected.stornoInvoicePdfUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-orange-600 hover:underline">
                        Storno-Rechnung
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
                {selected.status === "CAPTURED" && selected.invoiceNumber && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    disabled={resendingId === selected.id}
                    onClick={() => handleResendInvoice(selected)}
                    title="Rechnung an Shugyo und Gutschrift an Takumi erneut per E-Mail senden"
                  >
                    {resendingId === selected.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Rechnung per E-Mail erneut senden
                  </Button>
                )}
                {selected.status === "CAPTURED" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    disabled={refunding || isRefundDisabled(selected)}
                    onClick={() => openRefundConfirm(selected)}
                    title={isRefundDisabled(selected) ? `Stornierung nur innerhalb von ${REFUND_MAX_AGE_DAYS} Tagen möglich (Stripe-Limit)` : undefined}
                  >
                    {refunding ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
                    Stornierung einleiten
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Export</DialogTitle>
            <DialogDescription>
              Zeitraum auswählen. Max. {MAX_EXPORT_DAYS} Tage (ca. 3 Monate) pro Vorgang.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="text-xs">Von</Label>
              <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Bis</Label>
              <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="mt-1" />
            </div>
            {exportFrom && exportTo && exportDays() > MAX_EXPORT_DAYS && (
              <p className="text-xs text-destructive">Zeitraum zu groß. Bitte verkürzen.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Abbrechen</Button>
            <Button variant="outline" onClick={() => handleExport("csv")} disabled={exporting || !exportFrom || !exportTo || exportDays() > MAX_EXPORT_DAYS} className="gap-2">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              CSV (Financial)
            </Button>
            <Button variant="outline" onClick={() => handleExport("datev")} disabled={exporting || !exportFrom || !exportTo || exportDays() > MAX_EXPORT_DAYS} className="gap-2">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              CSV (DATEV)
            </Button>
            <Button onClick={() => handleExport("zip")} disabled={exporting || !exportFrom || !exportTo || exportDays() > MAX_EXPORT_DAYS} className="gap-2">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
              ZIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation AlertDialog */}
      <AlertDialog open={refundConfirmOpen} onOpenChange={setRefundConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stornierung bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du die Zahlung von <strong>{refundTarget ? eur(refundTarget.totalAmount) : "—"}</strong> wirklich zurückerstatten?
              Dieser Vorgang erstellt automatisch eine Storno-Rechnung und eine Storno-Gutschrift.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRefundTarget(null)}>Abbrechen</AlertDialogCancel>
            <Button variant="destructive" onClick={handleRefundConfirm} disabled={refunding} className="gap-2">
              {refunding ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
              Ja, stornieren
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hold Action Confirmation (Force Capture / Manual Release) */}
      <AlertDialog open={!!holdAction} onOpenChange={(o) => !o && closeHoldAction()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {holdAction === "force_capture" ? "An Takumi freigeben" : "An Shugyo zurückerstatten"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {holdAction === "force_capture" ? (
                <>
                  Betrag an Takumi freigeben? Rechnung und Gutschrift werden erstellt.
                  {holdTarget && (
                    <span className="block mt-2 font-medium text-foreground">
                      {holdTarget.shugyoName} → {holdTarget.takumiName} · {eur(holdTarget.amountCents)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  Shugyo-Kreditlimit freigeben. Der Hold wird storniert, das Geld wird zurückerstattet (Stripe: PaymentIntent cancel, Wallet: Guthaben zurück).
                  {holdTarget && (
                    <span className="block mt-2 font-medium text-foreground">
                      {holdTarget.shugyoName} → {holdTarget.takumiName} · {eur(holdTarget.amountCents)}
                    </span>
                  )}
                </>
              )}
              <span className="block mt-3 font-semibold text-foreground">
                Zur Bestätigung eingeben: <code className="bg-muted px-1.5 py-0.5 rounded">{HOLD_CONFIRM_PHRASE}</code>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">Bestätigung</Label>
            <Input
              value={holdConfirmPhrase}
              onChange={(e) => setHoldConfirmPhrase(e.target.value)}
              placeholder={HOLD_CONFIRM_PHRASE}
              className="mt-1 font-mono"
              onPaste={(e) => e.preventDefault()}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeHoldAction}>Abbrechen</AlertDialogCancel>
            <Button
              onClick={(e) => { e.preventDefault(); void executeHoldAction() }}
              disabled={holdConfirmPhrase !== HOLD_CONFIRM_PHRASE || holdActioning}
              className="gap-2"
            >
              {holdActioning ? <Loader2 className="size-4 animate-spin" /> : null}
              {holdAction === "force_capture" ? "An Takumi freigeben" : "An Shugyo zurückerstatten"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [dataRefreshKey, setDataRefreshKey] = useState(0)

  async function loadStats() {
    setStatsLoading(true)
    try {
      const res = await fetch("/api/admin/stats")
      if (res.ok) {
        const data = (await res.json()) as Stats
        setStats(data)
        if (data.degraded && data.degradedReason) {
          toast.warning(data.degradedReason)
        }
      }
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
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">Admin-Dashboard</h1>
                <Badge className="border-destructive/30 bg-destructive/10 text-destructive text-[10px] shrink-0" variant="outline">
                  Admin
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground mt-0.5">
                <Shield className="inline size-3 mr-1" />
                {adminName}
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs shrink-0" onClick={loadStats} disabled={statsLoading}>
              <RefreshCw className={`size-3.5 ${statsLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Aktualisieren</span>
            </Button>
          </div>

          {/* Quick-KPI bar */}
          {stats && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Nutzer", value: stats.users.total, icon: Users, color: "text-blue-500", tab: "users" as const },
                { label: "Takumis", value: `${stats.experts.live}/${stats.experts.total}`, icon: Activity, color: "text-green-500", tab: "takumis" as const },
                { label: "Buchungen", value: stats.bookings.total, icon: CalendarDays, color: "text-purple-500", tab: "bookings" as const },
                { label: "Umsatz", value: eur(stats.revenue.totalCents), icon: Euro, color: "text-orange-500", tab: "finance" as const },
              ].map(({ label, value, icon: Icon, color, tab }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="flex flex-col items-center rounded-xl border border-border/50 bg-card p-2 text-center transition-colors hover:bg-muted/50 active:scale-[0.98]"
                >
                  <Icon className={`size-4 ${color} mb-1`} />
                  <span className="text-sm font-bold text-foreground leading-tight truncate max-w-full">{value}</span>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tabs — horizontal scrollbar auf Mobile */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-xl bg-muted p-1">
              <TabsTrigger value="overview"  className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><BarChart3  className="size-3.5 mr-1" /><span className="hidden xs:inline">Übersicht</span><span className="xs:hidden">Über.</span></TabsTrigger>
              <TabsTrigger value="analytics" className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><LineChart className="size-3.5 mr-1" /><span className="hidden sm:inline">Traffic</span><span className="sm:hidden">Web</span></TabsTrigger>
              <TabsTrigger value="users"     className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><Users      className="size-3.5 mr-1" />Nutzer</TabsTrigger>
              <TabsTrigger value="bookings"  className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><CalendarDays className="size-3.5 mr-1" /><span className="hidden xs:inline">Buchungen</span><span className="xs:hidden">Buch.</span></TabsTrigger>
              <TabsTrigger value="takumis"   className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><Star       className="size-3.5 mr-1" />Takumis</TabsTrigger>
              <TabsTrigger value="finance"   className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><CreditCard className="size-3.5 mr-1" /><span className="hidden xs:inline">Finanzen</span><span className="xs:hidden">Fin.</span></TabsTrigger>
              <TabsTrigger value="safety"    className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><Shield     className="size-3.5 mr-1" /><span className="hidden xs:inline">Sicherheit</span><span className="xs:hidden">Safe</span></TabsTrigger>
              <TabsTrigger value="scanner"   className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><Scan       className="size-3.5 mr-1" />Scanner</TabsTrigger>
              <TabsTrigger value="system"    className="flex-1 basis-[calc(25%-4px)] text-xs px-2 py-1.5 sm:flex-none sm:px-3"><Database   className="size-3.5 mr-1" />System</TabsTrigger>
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

            <TabsContent value="analytics" className="mt-4">
              <AdminAnalyticsTab />
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <UsersTab onDataChanged={() => { setDataRefreshKey(k => k + 1); void loadStats() }} />
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">
              <BookingsTab />
            </TabsContent>

            <TabsContent value="takumis" className="mt-4">
              <TakumisTab refreshKey={dataRefreshKey} />
            </TabsContent>

            <TabsContent value="finance" className="mt-4">
              <div className="flex flex-col gap-4">
                <FinanceTab />
                <div className="rounded-xl border border-border/50 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Finance Monitoring</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Escrow-Holds, Stripe-Audit, manuelle Freigaben</p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                      <Link href="/admin/finance"><ExternalLink className="size-3.5" />Öffnen</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="safety" className="mt-4">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                        <Shield className="size-5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Safety Reports</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Nutzermeldungen aus Video-Calls — Sperren, Freigaben, Auflösung</p>
                        <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5 h-8 text-xs">
                          <Link href="/admin/safety"><ExternalLink className="size-3" />Safety verwalten</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                        <AlertTriangle className="size-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">KI-Incidents</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Automatisch erkannte Verstöße (Google Vision SafeSearch)</p>
                        <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5 h-8 text-xs">
                          <Link href="/admin/safety/incidents"><ExternalLink className="size-3" />Incidents öffnen</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    <strong>Automatischer Schutz aktiv:</strong> Alle Video-Calls werden bei 5s · 30s · 60s · 90s · 120s per Google Vision SafeSearch geprüft.
                    Bei einem Verstoß (LIKELY/VERY_LIKELY) wird die Verbindung sofort getrennt und ein Incident erstellt.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scanner" className="mt-4">
              <VisionScannerTab />
            </TabsContent>

            <TabsContent value="system" className="mt-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                        <Tags className="size-5 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Kategorien & Fachbereiche</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Taxonomie pflegen, Lucide-Icon oder eigenes Bild, Takumi-Zuordnung</p>
                        <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5 h-8 text-xs">
                          <Link href="/admin/taxonomy"><ExternalLink className="size-3" />Öffnen</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                        <Activity className="size-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Health Check</p>
                        <p className="text-xs text-muted-foreground mt-0.5">CRON-Monitor, Stripe Escrow, Wallet-Integrität, Push-Erreichbarkeit</p>
                        <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5 h-8 text-xs">
                          <Link href="/admin/health-check"><ExternalLink className="size-3" />Öffnen</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10">
                        <Newspaper className="size-5 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Startseiten-News</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Redaktioneller Newsfeed auf der Home-Seite (Titel, Text, optionaler Link)
                        </p>
                        <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5 h-8 text-xs">
                          <Link href="/admin/home-news"><ExternalLink className="size-3" />News bearbeiten</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                        <Mail className="size-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Waymail Templates</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Nachrichtenvorlagen verwalten, Testmails senden (DE/EN/ES)</p>
                        <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5 h-8 text-xs">
                          <Link href="/admin/templates"><ExternalLink className="size-3" />Öffnen</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DatabaseTab categories={categories} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </PageContainer>
    </div>
  )
}

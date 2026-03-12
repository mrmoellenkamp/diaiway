"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
  Euro,
  CreditCard,
  Wallet,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronLeft,
  Lock,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react"

// ─── Types ─────────────────────────────────────────────────────────────────

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
}

type AuditItem = {
  id: string
  type: "transaction" | "wallet" | "admin_action"
  createdAt: string
  amountCents?: number
  status?: string
  description: string
  referenceId: string | null
  profileUrl: string | null
  paymentType?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function eur(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function expiryBg(h: HoldItem): string {
  if (h.paymentType === "wallet") return ""
  if (h.expiryStatus === "critical") return "bg-red-500/15 dark:bg-red-500/10"
  if (h.expiryStatus === "warning") return "bg-yellow-500/15 dark:bg-yellow-500/10"
  return ""
}

// ─── Double confirmation ───────────────────────────────────────────────────

const CONFIRM_PHRASE = "BESTÄTIGEN"

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AdminFinancePage() {
  const [summary, setSummary] = useState<{
    holds: HoldItem[]
    totalShugyoWalletCents: number
    stripeHoldDays: number
  } | null>(null)
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [actionType, setActionType] = useState<"force_capture" | "manual_release" | null>(null)
  const [actionTarget, setActionTarget] = useState<HoldItem | null>(null)
  const [confirmPhrase, setConfirmPhrase] = useState("")
  const [actioning, setActioning] = useState(false)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/finance/summary")
      const data = await res.json()
      if (res.ok) setSummary(data)
      else toast.error(data.error ?? "Fehler beim Laden")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    try {
      const res = await fetch("/api/admin/finance/audit-log?limit=50")
      const data = await res.json()
      if (res.ok && Array.isArray(data.items)) setAuditItems(data.items)
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => { void loadSummary() }, [loadSummary])
  useEffect(() => { void loadAudit() }, [loadAudit])

  function openAction(type: "force_capture" | "manual_release", target: HoldItem) {
    setActionType(type)
    setActionTarget(target)
    setConfirmPhrase("")
  }

  function closeAction() {
    setActionType(null)
    setActionTarget(null)
    setConfirmPhrase("")
  }

  async function executeAction() {
    if (!actionTarget || !actionType || confirmPhrase !== CONFIRM_PHRASE) return
    setActioning(true)
    try {
      const path =
        actionType === "force_capture"
          ? "/api/admin/finance/force-capture"
          : "/api/admin/finance/manual-release"
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: actionTarget.bookingId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message ?? "Aktion durchgeführt.")
        closeAction()
        void loadSummary()
        void loadAudit()
      } else {
        toast.error(data.error ?? "Aktion fehlgeschlagen.")
      }
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setActioning(false)
    }
  }

  const holds = summary?.holds ?? []
  const totalWallet = summary?.totalShugyoWalletCents ?? 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageContainer>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/admin">
                  <ChevronLeft className="size-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Financial Monitoring</h1>
                <p className="text-xs text-muted-foreground">
                  Escrow-Übersicht · Stripe Holds · Wallet-Liability · Manuelle Intervention
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { void loadSummary(); void loadAudit() }} disabled={loading} className="gap-1.5">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{holds.length}</p>
                    <p className="text-xs text-muted-foreground">Offene Holds</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Wallet className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{eur(totalWallet)}</p>
                    <p className="text-xs text-muted-foreground">Shugyo Wallet-Liability</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Stripe Hold: {summary?.stripeHoldDays ?? 7} Tage</p>
                    <p className="text-xs text-muted-foreground">Holds verfallen nach 7 Tagen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Holds Table */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Escrow-Holds</CardTitle>
              <p className="text-xs text-muted-foreground">
                Rot = &gt;6 Tage / abgelaufen · Gelb = 4–6 Tage
              </p>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              )}
              {!loading && holds.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">Keine offenen Holds</div>
              )}
              {!loading && holds.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Booking</TableHead>
                      <TableHead>Shugyo</TableHead>
                      <TableHead>Takumi</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead>Auth-Datum</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="w-[200px] text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holds.map((h) => (
                      <TableRow key={h.bookingId} className={expiryBg(h)}>
                        <TableCell className="font-mono text-xs">{h.bookingId.slice(0, 8)}…</TableCell>
                        <TableCell>
                          <Link href={`/user/${h.shugyoUserId}`} className="text-primary hover:underline text-sm">
                            {h.shugyoName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/takumi/${h.takumiExpertId}`} className="text-primary hover:underline text-sm">
                            {h.takumiName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-medium">{eur(h.amountCents)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(h.authDate)}</TableCell>
                        <TableCell>
                          {h.paymentType === "wallet" ? (
                            <Badge variant="outline" className="text-[10px]">Wallet</Badge>
                          ) : h.daysUntilExpiry != null ? (
                            <span className={h.expiryStatus === "critical" ? "text-red-600 font-medium" : h.expiryStatus === "warning" ? "text-yellow-600 font-medium" : "text-muted-foreground"}>
                              {h.daysUntilExpiry}d
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {h.paymentType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => openAction("force_capture", h)}
                            >
                              <CheckCircle2 className="size-3" />
                              Force Capture
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                              onClick={() => openAction("manual_release", h)}
                            >
                              <XCircle className="size-3" />
                              Manual Release
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Audit Log */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                Transaction Audit Log
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Stripe-Events, Wallet-Transaktionen und Admin-Aktionen
              </p>
            </CardHeader>
            <CardContent>
              {auditLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!auditLoading && (
                <ScrollArea className="h-[280px] rounded-md border border-border/50">
                  <div className="p-2 space-y-1">
                    {auditItems.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">Keine Einträge</p>
                    )}
                    {auditItems.map((a) => (
                      <div
                        key={`${a.type}-${a.id}`}
                        className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-muted-foreground font-mono">
                            {formatDate(a.createdAt)}
                          </span>
                          <span className="ml-2 text-foreground">{a.description}</span>
                          {a.amountCents != null && (
                            <span className="ml-2 font-medium">{eur(a.amountCents)}</span>
                          )}
                        </div>
                        {a.profileUrl && a.referenceId && (
                          <Link
                            href={a.profileUrl}
                            className="shrink-0 text-primary hover:underline flex items-center gap-0.5"
                          >
                            Profil
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>

      {/* Double confirmation modal */}
      <AlertDialog open={!!actionType} onOpenChange={(o) => !o && closeAction()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "force_capture" ? "Force Capture" : "Manual Release"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "force_capture" ? (
                <>
                  Session wurde abgeschlossen, aber der Trigger ist fehlgeschlagen. Capture jetzt erzwingen?
                  {actionTarget && (
                    <span className="block mt-2 font-medium text-foreground">
                      Buchung {actionTarget.bookingId.slice(0, 8)}… · {eur(actionTarget.amountCents)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  Shugyo-Kreditlimit manuell freigeben. Der Hold wird storniert und das Geld wird zurückerstattet.
                  {actionTarget && (
                    <span className="block mt-2 font-medium text-foreground">
                      Buchung {actionTarget.bookingId.slice(0, 8)}… · {eur(actionTarget.amountCents)}
                    </span>
                  )}
                </>
              )}
              <span className="block mt-3 font-semibold text-foreground">
                Zur Bestätigung eingeben: <code className="bg-muted px-1.5 py-0.5 rounded">{CONFIRM_PHRASE}</code>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">Bestätigung</Label>
            <Input
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="mt-1 font-mono"
              onPaste={(e) => e.preventDefault()}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeAction}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void executeAction()
              }}
              disabled={confirmPhrase !== CONFIRM_PHRASE || actioning}
              className="gap-2"
            >
              {actioning ? <Loader2 className="size-4 animate-spin" /> : null}
              {actionType === "force_capture" ? "Capture durchführen" : "Freigeben"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

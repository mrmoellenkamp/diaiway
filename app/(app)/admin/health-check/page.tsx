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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Clock,
  CreditCard,
  Wallet,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Eye,
} from "lucide-react"

type HealthData = {
  degraded?: boolean
  degradedReason?: string
  visionConfig?: { configured: boolean; method: "api_key" | "service_account" | null }
  cronMonitor: { "release-wallet": string | null; "experts-offline": string | null }
  stripeEscrow: Array<{
    bookingId: string
    userName: string
    expertName: string
    paidAt: string | null
    transactionId?: string
    transactionStatus?: string
  }>
  walletIntegrity: Array<{
    userId: string
    userName: string
    balanceCents: number
    sumWalletTxCents: number
    diffCents: number
  }>
  pushReachability: {
    availableTakumis: number
    availableWithoutPush: number
    percentWithoutPush: number
  }
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

function eur(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    cents / 100
  )
}

export default function AdminHealthCheckPage() {
  const { t } = useI18n()
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [forceCaptureBookingId, setForceCaptureBookingId] = useState<string | null>(null)
  const [actioning, setActioning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/health-check")
      const json = await res.json()
      if (res.ok) setData(json)
      else toast.error(json.error ?? t("toast.loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleForceCapture(bookingId: string) {
    setActioning(true)
    try {
      const res = await fetch("/api/admin/finance/force-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message ?? t("admin.captureDone"))
        setForceCaptureBookingId(null)
        void load()
      } else {
        toast.error(json.error ?? t("admin.captureFailed"))
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setActioning(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("admin.healthCheckLoading")}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/admin">
                  <ArrowLeft className="size-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Health-Check</h1>
                <p className="text-xs text-muted-foreground">
                  {t("admin.healthSubtitle")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              {t("admin.refresh")}
            </Button>
          </div>

          {data && (
            <>
              {data.degraded && data.degradedReason && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  <span className="font-semibold">Datenbank nicht erreichbar. </span>
                  {data.degradedReason}
                </div>
              )}
              {/* Vision API (Bildprüfung) */}
              {data.visionConfig !== undefined && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Eye className="size-4 text-muted-foreground" />
                      BILDPRÜFUNG (VISION API)
                      {data.visionConfig.configured ? (
                        <span className="ml-2 rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-500">
                          {data.visionConfig.method === "api_key" ? "API-Key" : "Service Account"}
                        </span>
                      ) : (
                        <span className="ml-2 rounded bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
                          {t("admin.notConfigured")}
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{t("admin.visionApiHint")}</p>
                  </CardHeader>
                </Card>
              )}

              {/* Cron Monitor */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="size-4 text-muted-foreground" />
                    CRON-MONITOR
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cron</TableHead>
                        <TableHead>Letzter Lauf</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">release-wallet</TableCell>
                        <TableCell>
                          {data.cronMonitor["release-wallet"]
                            ? formatDate(data.cronMonitor["release-wallet"])
                            : "—"}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">experts-offline</TableCell>
                        <TableCell>
                          {data.cronMonitor["experts-offline"]
                            ? formatDate(data.cronMonitor["experts-offline"])
                            : "—"}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Stripe Escrow */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="size-4 text-muted-foreground" />
                    STRIPE-ESCROW-CHECK
                    {data.stripeEscrow.length > 0 && (
                      <span className="ml-2 rounded bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
                        {data.stripeEscrow.length} Expiry-Risiko
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Buchungen &gt;6 Tage, paymentStatus paid, Transaction AUTHORIZED/PENDING (7-Tage-Stripe-Expiry)
                  </p>
                </CardHeader>
                <CardContent>
                  {data.stripeEscrow.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.noRiskBookings")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Buchung</TableHead>
                          <TableHead>Shugyo</TableHead>
                          <TableHead>Takumi</TableHead>
                          <TableHead>Bezahlt am</TableHead>
                          <TableHead className="w-24">Aktion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.stripeEscrow.map((b) => (
                          <TableRow key={b.bookingId}>
                            <TableCell className="font-mono text-xs">{b.bookingId.slice(-8)}</TableCell>
                            <TableCell>{b.userName}</TableCell>
                            <TableCell>{b.expertName}</TableCell>
                            <TableCell>{formatDate(b.paidAt)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setForceCaptureBookingId(b.bookingId)}
                              >
                                Force Capture
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Wallet Integrity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="size-4 text-muted-foreground" />
                    WALLET-INTEGRITÄT
                    {data.walletIntegrity.length > 0 && (
                      <span className="ml-2 rounded bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
                        {data.walletIntegrity.length} Diskrepanzen
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Summe(WalletTransaction) vs. User.balance — Abweichungen rot markiert
                  </p>
                </CardHeader>
                <CardContent>
                  {data.walletIntegrity.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                      <CheckCircle2 className="size-4" />
                      {t("admin.noDiscrepancies")}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Balance (DB)</TableHead>
                          <TableHead>Summe (WTx)</TableHead>
                          <TableHead>Differenz</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.walletIntegrity.map((w) => (
                          <TableRow key={w.userId} className="bg-destructive/10">
                            <TableCell>
                              <span className="font-medium">{w.userName}</span>
                              <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                {w.userId.slice(-6)}
                              </span>
                            </TableCell>
                            <TableCell>{eur(w.balanceCents)}</TableCell>
                            <TableCell>{eur(w.sumWalletTxCents)}</TableCell>
                            <TableCell className="font-semibold text-destructive">
                              {w.diffCents > 0 ? "+" : ""}{eur(w.diffCents)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Push Reachability */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="size-4 text-muted-foreground" />
                    PUSH-REACHABILITY
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Aktive Takumis (liveStatus=available) ohne PushSubscription/FcmToken
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-2">
                      <span className="text-2xl font-bold text-foreground">
                        {data.pushReachability.percentWithoutPush}%
                      </span>
                      <p className="text-xs text-muted-foreground">
                        ohne Push ({data.pushReachability.availableWithoutPush} /{" "}
                        {data.pushReachability.availableTakumis})
                      </p>
                    </div>
                    {data.pushReachability.percentWithoutPush > 0 && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                        <AlertTriangle className="size-4" />
                        <span className="text-sm">
                          {t("admin.pushWarning")}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PageContainer>

      <AlertDialog open={!!forceCaptureBookingId} onOpenChange={() => setForceCaptureBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.forceCaptureTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.forceCaptureDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actioning}>{t("common.cancel")}</AlertDialogCancel>
            <Button
              onClick={() =>
                forceCaptureBookingId && handleForceCapture(forceCaptureBookingId)
              }
              disabled={actioning}
              className="gap-2"
            >
              {actioning && <Loader2 className="size-4 animate-spin" />}
              Force Capture
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { Capacitor } from "@capacitor/core"
import { PageContainer } from "@/components/page-container"
import { AppSubpageHeader } from "@/components/app-subpage-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Wallet, FileText, Download, Loader2, Receipt, Plus, ShieldCheck, ExternalLink, BadgeCheck, AlertTriangle, Clock } from "lucide-react"
import { openExternalBrowser } from "@/lib/native-browser"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"
import { useWalletTopup } from "@/lib/wallet-topup-context"
import { StripeConnectOnboarding } from "@/components/stripe-connect-onboarding"
import { cn } from "@/lib/utils"
function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  const sign = cents < 0 ? "−" : ""
  return `${sign}€${(abs / 100).toFixed(2).replace(".", ",")}`
}

type TxItem = {
  id: string
  type: "paid" | "earned" | "topup" | "deduction" | "refund"
  amount: number
  status: string
  bookingId: string | null
  label: string
  date: string
  createdAt: string
  invoiceNumber?: string | null
  invoicePdfUrl?: string | null
  stornoInvoiceNumber?: string | null
  stornoInvoicePdfUrl?: string | null
  creditNoteNumber?: string | null
  creditNotePdfUrl?: string | null
  stornoCreditNoteNumber?: string | null
  stornoCreditNotePdfUrl?: string | null
  commissionInvoiceNumber?: string | null
  commissionInvoicePdfUrl?: string | null
}

export default function FinancesPage() {
  const { t } = useI18n()
  const { openWalletTopup } = useWalletTopup()
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<TxItem[]>([])
  const [refundPreference, setRefundPreference] = useState<"payout" | "wallet">("payout")
  const [appRole, setAppRole] = useState<string>("shugyo")
  const [wallet, setWallet] = useState<{
    balance: number
    pendingBalance: number
    canWithdraw: boolean
  } | null>(null)
  const [cancelFreeHours, setCancelFreeHours] = useState(24)
  const [cancelFeePercent, setCancelFeePercent] = useState(0)
  const [connectStatus, setConnectStatus] = useState<{
    status: "not_connected" | "pending" | "active" | "restricted" | null
    loading: boolean
    error: boolean
  }>({ status: null, loading: false, error: false })
  const [connectModal, setConnectModal] = useState<{ open: boolean; mode: "onboarding" | "management" }>({
    open: false,
    mode: "onboarding",
  })
  const [savingCancelPolicy, setSavingCancelPolicy] = useState(false)
  const [customerNumber, setCustomerNumber] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const opts = { cache: "no-store" as RequestCache, credentials: "include" as RequestCredentials }
    Promise.all([
      fetch("/api/wallet/history", opts).then((r) => r.json()),
      fetch("/api/user/profile", opts).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/user/takumi-profile", opts).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([walletData, profileData, takumiData]) => {
        if (cancelled) return
        if (walletData?.history) setHistory(walletData.history)
        if (walletData?.wallet) setWallet(walletData.wallet)
        if (profileData?.refundPreference) {
          setRefundPreference(profileData.refundPreference === "wallet" ? "wallet" : "payout")
        }
        if (profileData?.appRole) setAppRole(profileData.appRole)
        if (typeof profileData?.customerNumber === "string" && profileData.customerNumber.trim()) {
          setCustomerNumber(profileData.customerNumber.trim())
        } else {
          setCustomerNumber(null)
        }
        if (takumiData?.exists && takumiData?.cancelPolicy) {
          const cp = takumiData.cancelPolicy as { freeHours?: number; feePercent?: number }
          setCancelFreeHours(typeof cp.freeHours === "number" ? cp.freeHours : 24)
          setCancelFeePercent(typeof cp.feePercent === "number" ? cp.feePercent : 0)
        }
        // Stripe Connect Status nur für Takumis laden
        if (profileData?.appRole === "takumi") {
          setConnectStatus(s => ({ ...s, loading: true }))
          fetch("/api/stripe/connect/status", { credentials: "include" })
            .then(r => r.json())
            .then(data => {
              if (!cancelled) setConnectStatus({ status: data.status ?? "not_connected", loading: false, error: false })
            })
            .catch(() => {
              if (!cancelled) setConnectStatus({ status: null, loading: false, error: true })
            })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const refetchWallet = useCallback(async () => {
    try {
      const opts = { cache: "no-store" as RequestCache, credentials: "include" as RequestCredentials }
      const [walletData, profileData] = await Promise.all([
        fetch("/api/wallet/history", opts).then((r) => r.json()),
        fetch("/api/user/profile", opts).then((r) => (r.ok ? r.json() : null)),
      ])
      if (walletData?.history) setHistory(walletData.history)
      if (walletData?.wallet) setWallet(walletData.wallet)
      if (profileData?.refundPreference) {
        setRefundPreference(profileData.refundPreference === "wallet" ? "wallet" : "payout")
      }
      if (profileData?.appRole) setAppRole(profileData.appRole)
    } catch { /* ignore */ }
  }, [])

  const openConnectModal = useCallback((mode: "onboarding" | "management") => {
    setConnectModal({ open: true, mode })
  }, [])

  // Bei Rückkehr zur App/Tab: Wallet neu laden (z.B. nach Webhook-Gutschrift)
  useEffect(() => {
    const onVisible = () => void refetchWallet()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onVisible()
    }
    window.addEventListener("focus", onVisible)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("focus", onVisible)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [refetchWallet])

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <AppSubpageHeader
          title={t("finances.title")}
          subtitle={t("finances.transactions")}
          trailing={
            customerNumber ? (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("invoice.customerNumberLabel")}
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{customerNumber}</span>
              </div>
            ) : null
          }
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Salden */}
            <Card className="border-[rgba(6,78,59,0.2)] bg-[rgba(6,78,59,0.05)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wallet className="size-4 text-primary" />
                  {t("finances.balance")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2 rounded-lg border border-[rgba(231,229,227,0.6)] bg-background p-3">
                    <p className="text-[10px] text-muted-foreground">{t("finances.balance")}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xl font-bold text-foreground">
                        {wallet ? formatCents(wallet.balance) : "€0,00"}
                      </p>
                      {Capacitor.isNativePlatform() ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 shrink-0 text-primary hover:bg-[rgba(6,78,59,0.1)] hover:text-primary"
                          onClick={() => void openExternalBrowser("https://diaiway.com/profile/finances")}
                        >
                          <ExternalLink className="size-3.5" />
                          <span className="text-xs">{t("wallet.nativeHintAction")}</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => openWalletTopup(refetchWallet)}
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 shrink-0 text-primary hover:bg-[rgba(6,78,59,0.1)] hover:text-primary"
                        >
                          <Plus className="size-3.5" />
                          <span className="text-xs">{t("finances.topup")}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[rgba(231,229,227,0.6)] bg-background p-3">
                    <p className="text-[10px] text-muted-foreground">{t("finances.pendingBalance")}</p>
                    <p className="text-xl font-bold text-muted-foreground">
                      {wallet ? formatCents(wallet.pendingBalance) : "€0,00"}
                    </p>
                  </div>
                </div>
                {wallet?.canWithdraw && (
                  <p className="mt-2 text-xs text-primary">{t("finances.canWithdraw")}</p>
                )}
              </CardContent>
            </Card>

            {/* Stripe Connect Auszahlungskonto (nur Takumi) */}
            {appRole === "takumi" && (
              <Card className="border-[rgba(231,229,227,0.6)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Wallet className="size-4 text-primary" />
                    {t("finances.connectTitle")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t("finances.connectDesc")}</p>
                </CardHeader>
                <CardContent>
                  {connectStatus.loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      {t("finances.connectLoading")}
                    </div>
                  ) : connectStatus.error ? (
                    <p className="text-sm text-destructive">{t("finances.connectError")}</p>
                  ) : connectStatus.status === "active" ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-[rgba(5,46,22,0.3)] border border-green-200 dark:border-green-800 p-3">
                        <BadgeCheck className="size-4 shrink-0 text-green-600" />
                        <p className="text-sm text-green-700 dark:text-green-400">{t("finances.connectActive")}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit gap-2"
                        onClick={() => openConnectModal("management")}
                      >
                        <ExternalLink className="size-3.5" />
                        {t("finances.connectManage")}
                      </Button>
                    </div>
                  ) : connectStatus.status === "restricted" ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-[rgba(66,32,6,0.3)] border border-yellow-200 dark:border-yellow-800 p-3">
                        <AlertTriangle className="size-4 shrink-0 text-yellow-600" />
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">{t("finances.connectRestricted")}</p>
                      </div>
                      <Button size="sm" className="w-fit gap-2" onClick={() => openConnectModal("onboarding")}>
                        <ExternalLink className="size-3.5" />
                        {t("finances.connectManage")}
                      </Button>
                    </div>
                  ) : connectStatus.status === "pending" ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-[rgba(23,37,84,0.3)] border border-blue-200 dark:border-blue-800 p-3">
                        <Clock className="size-4 shrink-0 text-blue-600" />
                        <p className="text-sm text-blue-700 dark:text-blue-400">{t("finances.connectPending")}</p>
                      </div>
                      <Button size="sm" className="w-fit gap-2" onClick={() => openConnectModal("onboarding")}>
                        <ExternalLink className="size-3.5" />
                        {t("finances.connectSetup")}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="gap-2" onClick={() => openConnectModal("onboarding")}>
                      <ExternalLink className="size-3.5" />
                      {t("finances.connectSetup")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stornierungsrichtlinie (nur Takumi) */}
            {appRole === "takumi" && (
              <Card className="border-[rgba(231,229,227,0.6)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="size-4 text-primary" />
                    {t("editProfile.cancelPolicy")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t("editProfile.cancelPolicyDesc")}</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("editProfile.cancelFreeHours")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[0, 12, 24, 48, 72].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setCancelFreeHours(h)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            cancelFreeHours === h
                              ? "border-primary bg-[rgba(6,78,59,0.1)] text-primary"
                              : "border-border bg-[rgba(245,245,244,0.3)] text-muted-foreground hover:border-[rgba(6,78,59,0.5)]"
                          }`}
                        >
                          {h === 0
                            ? t("editProfile.cancelNeverFree")
                            : t("editProfile.cancelHours").replace("{h}", String(h))}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("editProfile.cancelFeePercent")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCancelFeePercent(p)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            cancelFeePercent === p
                              ? "border-primary bg-[rgba(6,78,59,0.1)] text-primary"
                              : "border-border bg-[rgba(245,245,244,0.3)] text-muted-foreground hover:border-[rgba(6,78,59,0.5)]"
                          }`}
                        >
                          {p === 0 ? t("editProfile.cancelNoFee") : `${p}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[rgba(245,245,244,0.4)] px-3 py-2.5 text-xs text-muted-foreground">
                    {cancelFreeHours === 0
                      ? t("editProfile.cancelSummaryNoFree").replace("{percent}", String(cancelFeePercent))
                      : cancelFeePercent === 0
                        ? t("editProfile.cancelSummaryFreeOnly").replace("{h}", String(cancelFreeHours))
                        : t("editProfile.cancelSummaryFull")
                            .replace("{h}", String(cancelFreeHours))
                            .replace("{percent}", String(cancelFeePercent))}
                  </div>
                  <Button
                    disabled={savingCancelPolicy}
                    onClick={async () => {
                      setSavingCancelPolicy(true)
                      try {
                        const res = await fetch("/api/user/takumi-profile", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            cancelPolicy: { freeHours: cancelFreeHours, feePercent: cancelFeePercent },
                          }),
                        })
                        if (res.ok) {
                          toast.success(t("finances.cancelPolicySaved"))
                        } else {
                          const data = await res.json()
                          toast.error(data.error || t("profile.error"))
                        }
                      } catch {
                        toast.error(t("common.networkError"))
                      } finally {
                        setSavingCancelPolicy(false)
                      }
                    }}
                    size="sm"
                    className="w-fit"
                  >
                    {savingCancelPolicy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      t("common.save")
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Rückerstattung bei Ablehnung (nur Shugyo) */}
            {appRole === "shugyo" && (
              <Card className="border-[rgba(231,229,227,0.6)] gap-0 py-0">
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="size-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{t("profile.refundPreference")}</span>
                      <p className="text-xs text-muted-foreground">{t("profile.refundPreferenceDesc")}</p>
                    </div>
                  </div>
                  <RadioGroup
                    value={refundPreference}
                    onValueChange={async (v: "payout" | "wallet") => {
                      const prev = refundPreference
                      setRefundPreference(v)
                      try {
                        const res = await fetch("/api/user/profile", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ refundPreference: v }),
                        })
                        if (res.ok) {
                          toast.success(t("profile.refundPreferenceSaved"))
                        } else {
                          const data = await res.json()
                          toast.error(data.error || t("profile.error"))
                          setRefundPreference(prev)
                        }
                      } catch {
                        toast.error(t("common.networkError"))
                        setRefundPreference(prev)
                      }
                    }}
                    className="grid gap-2"
                  >
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border border-[rgba(231,229,227,0.4)] p-3 hover:bg-[rgba(245,245,244,0.3)]",
                        refundPreference === "payout" &&
                          "border-[rgba(6,78,59,0.5)] bg-[rgba(6,78,59,0.05)]",
                      )}
                    >
                      <RadioGroupItem value="payout" />
                      <div>
                        <span className="text-sm font-medium">{t("profile.refundPayout")}</span>
                        <p className="text-xs text-muted-foreground">{t("profile.refundPayoutDesc")}</p>
                      </div>
                    </label>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border border-[rgba(231,229,227,0.4)] p-3 hover:bg-[rgba(245,245,244,0.3)]",
                        refundPreference === "wallet" &&
                          "border-[rgba(6,78,59,0.5)] bg-[rgba(6,78,59,0.05)]",
                      )}
                    >
                      <RadioGroupItem value="wallet" />
                      <div>
                        <span className="text-sm font-medium">{t("profile.refundWallet")}</span>
                        <p className="text-xs text-muted-foreground">{t("profile.refundWalletDesc")}</p>
                      </div>
                    </label>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Transaktionen & Rechnungen */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Receipt className="size-4 text-primary" />
                  {t("finances.transactions")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("finances.noTransactions")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {history.map((tx) => {
                      const typeLabel =
                        tx.type === "paid"
                          ? t("finances.paid")
                          : tx.type === "earned"
                            ? t("finances.earned")
                            : tx.type === "topup"
                              ? t("finances.topupTx")
                              : tx.type === "refund"
                                ? t("finances.refundTx")
                                : t("finances.deductionTx")
                      const displayLabel =
                        tx.type === "topup" || tx.type === "refund" || tx.type === "deduction"
                          ? typeLabel
                          : tx.label
                      const isCredit =
                        tx.type === "earned" || tx.type === "topup" || tx.type === "refund"
                      return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[rgba(231,229,227,0.6)] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{displayLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.date}
                            {(tx.type === "paid" || tx.type === "earned") && ` · ${typeLabel}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              isCredit ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {formatCents(tx.amount)}
                          </span>
                          <div className="flex items-center gap-1">
                            {tx.type === "topup" && tx.invoicePdfUrl && (
                              <Button variant="ghost" size="icon" className="size-8" asChild>
                                <a
                                  href={tx.invoicePdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={t("finances.downloadInvoice")}
                                  title={tx.invoiceNumber ?? t("finances.downloadInvoice")}
                                >
                                  <Download className="size-4" />
                                </a>
                              </Button>
                            )}
                            {tx.type === "paid" && (
                              <>
                                {tx.invoicePdfUrl && (
                                  <Button variant="ghost" size="icon" className="size-8" asChild>
                                    <a
                                      href={`/api/billing/download/${tx.id}?type=invoice`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={t("finances.downloadInvoice")}
                                      title={tx.invoiceNumber ?? t("finances.downloadInvoice")}
                                    >
                                      <Download className="size-4" />
                                    </a>
                                  </Button>
                                )}
                                {tx.stornoInvoicePdfUrl && (
                                  <Button variant="ghost" size="icon" className="size-8" asChild>
                                    <a
                                      href={`/api/billing/download/${tx.id}?type=storno-invoice`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={t("finances.downloadStornoInvoice")}
                                      title={tx.stornoInvoiceNumber ?? t("finances.downloadStornoInvoice")}
                                    >
                                      <FileText className="size-4 text-muted-foreground" />
                                    </a>
                                  </Button>
                                )}
                              </>
                            )}
                            {tx.type === "earned" && (
                              <>
                                {tx.creditNotePdfUrl && (
                                  <Button variant="ghost" size="icon" className="size-8" asChild>
                                    <a
                                      href={`/api/billing/download/${tx.id}?type=credit`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={t("finances.downloadCreditNote")}
                                      title={tx.creditNoteNumber ?? t("finances.downloadCreditNote")}
                                    >
                                      <Download className="size-4" />
                                    </a>
                                  </Button>
                                )}
                                {tx.commissionInvoicePdfUrl && (
                                  <Button variant="ghost" size="icon" className="size-8" asChild>
                                    <a
                                      href={`/api/billing/download/${tx.id}?type=commission`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label="Provisionsrechnung herunterladen"
                                      title={tx.commissionInvoiceNumber ?? "Provisionsrechnung"}
                                    >
                                      <Receipt className="size-4 text-muted-foreground" />
                                    </a>
                                  </Button>
                                )}
                                {tx.stornoCreditNotePdfUrl && (
                                  <Button variant="ghost" size="icon" className="size-8" asChild>
                                    <a
                                      href={`/api/billing/download/${tx.id}?type=storno-credit`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={t("finances.downloadStornoCreditNote")}
                                      title={
                                        tx.stornoCreditNoteNumber ?? t("finances.downloadStornoCreditNote")
                                      }
                                    >
                                      <FileText className="size-4 text-muted-foreground" />
                                    </a>
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {connectModal.open && (
        <StripeConnectOnboarding
          mode={connectModal.mode}
          onClose={() => setConnectModal({ open: false, mode: "onboarding" })}
          onComplete={() => {
            setConnectModal({ open: false, mode: "onboarding" })
            // Status nach Onboarding neu laden
            setConnectStatus(s => ({ ...s, loading: true }))
            fetch("/api/stripe/connect/status", { credentials: "include" })
              .then(r => r.json())
              .then(data => setConnectStatus({ status: data.status ?? "not_connected", loading: false, error: false }))
              .catch(() => setConnectStatus({ status: null, loading: false, error: true }))
          }}
        />
      )}
    </PageContainer>
  )
}

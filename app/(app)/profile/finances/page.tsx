"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Wallet, FileText, Download, Loader2, Receipt, Plus, ShieldCheck } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"
import { useWalletTopup } from "@/lib/wallet-topup-context"
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
  const [savingCancelPolicy, setSavingCancelPolicy] = useState(false)

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
        if (takumiData?.exists && takumiData?.cancelPolicy) {
          const cp = takumiData.cancelPolicy as { freeHours?: number; feePercent?: number }
          setCancelFreeHours(typeof cp.freeHours === "number" ? cp.freeHours : 24)
          setCancelFeePercent(typeof cp.feePercent === "number" ? cp.feePercent : 0)
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
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/profile">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{t("finances.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("finances.transactions")}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Salden */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wallet className="size-4 text-primary" />
                  {t("finances.balance")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-[10px] text-muted-foreground">{t("finances.balance")}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xl font-bold text-foreground">
                        {wallet ? formatCents(wallet.balance) : "€0,00"}
                      </p>
                      <Button
                        onClick={() => openWalletTopup(refetchWallet)}
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 shrink-0 text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Plus className="size-3.5" />
                        <span className="text-xs">{t("finances.topup")}</span>
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background p-3">
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

            {/* Stornierungsrichtlinie (nur Takumi) */}
            {appRole === "takumi" && (
              <Card className="border-border/60">
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
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
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
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {p === 0 ? t("editProfile.cancelNoFee") : `${p}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
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
                          toast.success(t("editProfile.saved"))
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
                      t("editProfile.save")
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Rückerstattung bei Ablehnung (nur Shugyo) */}
            {appRole === "shugyo" && (
              <Card className="border-border/60 gap-0 py-0">
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
                    <label className="flex items-center gap-3 rounded-lg border border-border/40 p-3 cursor-pointer hover:bg-muted/30 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                      <RadioGroupItem value="payout" />
                      <div>
                        <span className="text-sm font-medium">{t("profile.refundPayout")}</span>
                        <p className="text-xs text-muted-foreground">{t("profile.refundPayoutDesc")}</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-border/40 p-3 cursor-pointer hover:bg-muted/30 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
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
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
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
    </PageContainer>
  )
}

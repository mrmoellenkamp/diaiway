"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Wallet, FileText, Download, Loader2, Receipt } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"
import { useWalletTopup } from "@/lib/wallet-topup-context"
import { formatDateBerlinShort } from "@/lib/date-utils"

function formatCents(cents: number): string {
  const abs = Math.abs(cents)
  const sign = cents < 0 ? "−" : ""
  return `${sign}€${(abs / 100).toFixed(2).replace(".", ",")}`
}

type TxItem = {
  id: string
  type: "paid" | "earned"
  amount: number
  status: string
  bookingId: string
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

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/wallet/history").then((r) => r.json()),
      fetch("/api/user/profile").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([walletData, profileData]) => {
        if (cancelled) return
        if (walletData?.history) setHistory(walletData.history)
        if (walletData?.wallet) setWallet(walletData.wallet)
        if (profileData?.refundPreference) {
          setRefundPreference(profileData.refundPreference === "wallet" ? "wallet" : "payout")
        }
        if (profileData?.appRole) setAppRole(profileData.appRole)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const refetchWallet = async () => {
    try {
      const [walletData, profileData] = await Promise.all([
        fetch("/api/wallet/history").then((r) => r.json()),
        fetch("/api/user/profile").then((r) => (r.ok ? r.json() : null)),
      ])
      if (walletData?.history) setHistory(walletData.history)
      if (walletData?.wallet) setWallet(walletData.wallet)
      if (profileData?.refundPreference) {
        setRefundPreference(profileData.refundPreference === "wallet" ? "wallet" : "payout")
      }
      if (profileData?.appRole) setAppRole(profileData.appRole)
    } catch { /* ignore */ }
  }

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
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="text-[10px] text-muted-foreground">{t("finances.balance")}</p>
                    <p className="text-xl font-bold text-foreground">
                      {wallet ? formatCents(wallet.balance) : "€0,00"}
                    </p>
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
                {appRole === "shugyo" && (
                  <Button
                    onClick={() => openWalletTopup(refetchWallet)}
                    className="mt-3 w-full gap-2"
                    variant="outline"
                  >
                    <Wallet className="size-4" />
                    {t("finances.topup")}
                  </Button>
                )}
              </CardContent>
            </Card>

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
                    {history.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{tx.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.date} · {tx.type === "paid" ? t("finances.paid") : t("finances.earned")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              tx.type === "paid" ? "text-destructive" : "text-primary"
                            }`}
                          >
                            {formatCents(tx.amount)}
                          </span>
                          <div className="flex items-center gap-1">
                            {tx.type === "paid" ? (
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
                            ) : (
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
                    ))}
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

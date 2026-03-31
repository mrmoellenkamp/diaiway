"use client"

import { useEffect, useState } from "react"
import { PageContainer } from "@/components/page-container"
import { AppSubpageHeader } from "@/components/app-subpage-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, FileText, Info, CheckCircle2, AlertCircle, Shield } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"
import { validateInvoiceDataForPayment } from "@/lib/invoice-requirements"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PaymentOnboardingModal } from "@/components/payment-onboarding-modal"

type InvoiceData = {
  type?: "privat" | "unternehmen"
  fullName?: string
  street?: string
  houseNumber?: string
  zip?: string
  city?: string
  country?: string
  email?: string
  companyName?: string
  vatId?: string
  taxNumber?: string
  kleinunternehmer?: boolean
}

const defaultPrivate: InvoiceData = {
  type: "privat",
  fullName: "",
  street: "",
  houseNumber: "",
  zip: "",
  city: "",
  country: "Deutschland",
  email: "",
}

function formatPhase2Instant(iso: string | null | undefined, locale: "de" | "en" | "es"): string {
  if (!iso) return ""
  try {
    const tag = locale === "de" ? "de-DE" : locale === "es" ? "es-ES" : "en-US"
    return new Date(iso).toLocaleString(tag, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return iso
  }
}

export default function InvoiceDataPage() {
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<InvoiceData>(defaultPrivate)
  const [customerNumber, setCustomerNumber] = useState<string | null>(null)
  const [appRole, setAppRole] = useState<"shugyo" | "takumi" | null>(null)
  const [isPaymentVerified, setIsPaymentVerified] = useState<boolean | null>(null)
  const [phase2BillingAt, setPhase2BillingAt] = useState<string | null>(null)
  const [phase2WaiverAt, setPhase2WaiverAt] = useState<string | null>(null)
  const [paymentOnboardingOpen, setPaymentOnboardingOpen] = useState(false)

  function applyProfilePayload(res: {
    invoiceData?: unknown
    customerNumber?: string | null
    appRole?: string
    isPaymentVerified?: boolean
    phase2BillingConsentAt?: string | null
    phase2WithdrawalWaiverAt?: string | null
  }) {
    if (res.invoiceData && typeof res.invoiceData === "object") {
      setData({ ...defaultPrivate, ...res.invoiceData } as InvoiceData)
    } else {
      setData(defaultPrivate)
    }
    setCustomerNumber(
      typeof res.customerNumber === "string" && res.customerNumber.trim() !== ""
        ? res.customerNumber.trim()
        : null,
    )
    if (res.appRole === "shugyo" || res.appRole === "takumi") {
      setAppRole(res.appRole)
    }
    if (typeof res.isPaymentVerified === "boolean") {
      setIsPaymentVerified(res.isPaymentVerified)
    }
    setPhase2BillingAt(
      typeof res.phase2BillingConsentAt === "string" && res.phase2BillingConsentAt
        ? res.phase2BillingConsentAt
        : null,
    )
    setPhase2WaiverAt(
      typeof res.phase2WithdrawalWaiverAt === "string" && res.phase2WithdrawalWaiverAt
        ? res.phase2WithdrawalWaiverAt
        : null,
    )
  }

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((res) => applyProfilePayload(res))
      .catch(() => {
        setData(defaultPrivate)
        setCustomerNumber(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const isCompany = data.type === "unternehmen"
  const paymentCheck = validateInvoiceDataForPayment(data)
  const missingFieldLabels =
    paymentCheck.ok ? [] : paymentCheck.missingFieldKeys.map((k) => t(`invoice.field.${k}`))
  const missingFieldsText = missingFieldLabels.join(", ")

  async function performSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceData: data }),
      })
      const result = await res.json()
      if (res.ok) {
        toast.success(t("invoice.saved"))
        const refreshed = await fetch("/api/user/profile").then((r) => r.json())
        applyProfilePayload(refreshed)
      } else {
        toast.error(result.error || t("profile.error"))
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!paymentCheck.ok) {
      toast.error(t("invoice.error.incomplete").replace("{fields}", missingFieldsText))
      return
    }
    if (appRole === "shugyo" && isPaymentVerified === false) {
      setPaymentOnboardingOpen(true)
      return
    }
    await performSave()
  }

  async function handlePaymentOnboardingSuccess() {
    try {
      const refreshed = await fetch("/api/user/profile").then((r) => r.json())
      applyProfilePayload(refreshed)
    } catch {
      /* Profil-Refresh optional; Modal aktualisiert App-Kontext */
    }
    await performSave()
  }

  const billingConsentLabel = formatPhase2Instant(phase2BillingAt, locale)
  const waiverConsentLabel = formatPhase2Instant(phase2WaiverAt, locale)
  const showPhase2Timestamps = Boolean(billingConsentLabel && waiverConsentLabel)

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <AppSubpageHeader
          title={t("invoice.title")}
          subtitle={t("invoice.subtitle")}
          trailing={
            customerNumber ? (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("invoice.customerNumberLabel")}
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {customerNumber}
                </span>
              </div>
            ) : null
          }
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Alert className="border-[rgba(6,78,59,0.25)] bg-[rgba(6,78,59,0.05)]">
              <Info className="text-primary" />
              <AlertTitle>{t("invoice.contextTitle")}</AlertTitle>
              <AlertDescription className="space-y-2 text-[rgba(28,25,23,0.9)]">
                <p>{t("invoice.contextProfile")}</p>
                <p>{t("invoice.contextPayment")}</p>
              </AlertDescription>
            </Alert>

            {appRole === "shugyo" ? (
              <Card className="border-[rgba(6,78,59,0.2)] bg-[rgba(6,78,59,0.03)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="size-4 text-primary" />
                    {t("invoice.phase2Title")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{t("invoice.phase2Intro")}</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {isPaymentVerified === true ? (
                    showPhase2Timestamps ? (
                      <Alert className="border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]">
                        <CheckCircle2 className="text-emerald-600" />
                        <AlertTitle>{t("invoice.phase2DoneTitle")}</AlertTitle>
                        <AlertDescription className="text-[rgba(28,25,23,0.9)]">
                          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                            <li>{t("invoice.phase2BillingLine", { date: billingConsentLabel })}</li>
                            <li>{t("invoice.phase2WaiverLine", { date: waiverConsentLabel })}</li>
                          </ul>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]">
                        <CheckCircle2 className="text-emerald-600" />
                        <AlertTitle>{t("invoice.phase2DoneTitle")}</AlertTitle>
                        <AlertDescription>{t("invoice.phase2DoneGeneric")}</AlertDescription>
                      </Alert>
                    )
                  ) : (
                    <>
                      <Alert className="border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.05)]">
                        <AlertCircle className="text-amber-600" />
                        <AlertTitle>{t("invoice.phase2PendingTitle")}</AlertTitle>
                        <AlertDescription>{t("invoice.phase2PendingBody")}</AlertDescription>
                      </Alert>
                      <Button type="button" variant="secondary" onClick={() => setPaymentOnboardingOpen(true)}>
                        {t("invoice.phase2Cta")}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {paymentCheck.ok ? (
              <Alert className="border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.05)]">
                <CheckCircle2 className="text-emerald-600" />
                <AlertTitle>{t("invoice.statusPaymentReadyTitle")}</AlertTitle>
                <AlertDescription>{t("invoice.statusPaymentReadyBody")}</AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.05)]">
                <AlertCircle className="text-amber-600" />
                <AlertTitle>{t("invoice.statusPaymentIncompleteTitle")}</AlertTitle>
                <AlertDescription>
                  {t("invoice.statusPaymentIncompleteBody", { fields: missingFieldsText })}
                </AlertDescription>
              </Alert>
            )}

            <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-primary" />
                {t("invoice.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Typ: Privat / Unternehmen */}
              <div className="space-y-2">
                <Label>{t("invoice.typePrivate")} / {t("invoice.typeCompany")}</Label>
                <RadioGroup
                  value={data.type || "privat"}
                  onValueChange={(v) =>
                    setData((prev) => ({
                      ...prev,
                      type: v as "privat" | "unternehmen",
                      ...(v === "unternehmen"
                        ? {
                            companyName: prev.companyName ?? "",
                            vatId: prev.vatId ?? "",
                            taxNumber: prev.taxNumber ?? "",
                            kleinunternehmer: prev.kleinunternehmer ?? false,
                          }
                        : {
                            companyName: undefined,
                            vatId: undefined,
                            taxNumber: undefined,
                            kleinunternehmer: undefined,
                          }),
                    }))
                  }
                  className="flex gap-4"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="privat" />
                    <span className="text-sm">{t("invoice.typePrivate")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="unternehmen" />
                    <span className="text-sm">{t("invoice.typeCompany")}</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Basis-Felder */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="fullName">
                    {isCompany ? t("invoice.fullNameCompany") : t("invoice.fullName")}
                  </Label>
                  <Input
                    id="fullName"
                    placeholder={t("invoice.fullNamePlaceholder")}
                    value={data.fullName || ""}
                    onChange={(e) => setData((p) => ({ ...p, fullName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="street">{t("invoice.street")}</Label>
                  <Input
                    id="street"
                    value={data.street || ""}
                    onChange={(e) => setData((p) => ({ ...p, street: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="houseNumber">{t("invoice.houseNumber")}</Label>
                  <Input
                    id="houseNumber"
                    value={data.houseNumber || ""}
                    onChange={(e) => setData((p) => ({ ...p, houseNumber: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="zip">{t("invoice.zip")}</Label>
                  <Input
                    id="zip"
                    value={data.zip || ""}
                    onChange={(e) => setData((p) => ({ ...p, zip: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="city">{t("invoice.city")}</Label>
                  <Input
                    id="city"
                    value={data.city || ""}
                    onChange={(e) => setData((p) => ({ ...p, city: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="country">{t("invoice.country")}</Label>
                  <Input
                    id="country"
                    value={data.country || ""}
                    onChange={(e) => setData((p) => ({ ...p, country: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="email">{t("invoice.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={data.email || ""}
                    onChange={(e) => setData((p) => ({ ...p, email: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Unternehmens-Felder */}
              {isCompany && (
                <div className="space-y-3 border-t border-border pt-4">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    {t("invoice.businessAddress")}
                  </Label>
                  <div>
                    <Label htmlFor="companyName">{t("invoice.companyName")}</Label>
                    <Input
                      id="companyName"
                      placeholder={t("invoice.companyNamePlaceholder")}
                      value={data.companyName || ""}
                      onChange={(e) => setData((p) => ({ ...p, companyName: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="vatId">{t("invoice.vatId")}</Label>
                      <Input
                        id="vatId"
                        value={data.vatId || ""}
                        onChange={(e) => setData((p) => ({ ...p, vatId: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxNumber">{t("invoice.taxNumber")}</Label>
                      <Input
                        id="taxNumber"
                        value={data.taxNumber || ""}
                        onChange={(e) => setData((p) => ({ ...p, taxNumber: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[rgba(231,229,227,0.6)] p-3">
                    <div>
                      <Label htmlFor="kleinunternehmer">{t("invoice.kleinunternehmer")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t("invoice.kleinunternehmerDesc")}
                      </p>
                    </div>
                    <Switch
                      id="kleinunternehmer"
                      checked={!!data.kleinunternehmer}
                      onCheckedChange={(v) => setData((p) => ({ ...p, kleinunternehmer: v }))}
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="mt-2">
                {saving ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> {t("common.saving")}</>
                ) : (
                  t("common.save")
                )}
              </Button>
            </CardContent>
          </Card>
          </div>
        )}
      </div>

      <PaymentOnboardingModal
        open={paymentOnboardingOpen}
        onOpenChange={setPaymentOnboardingOpen}
        onSuccess={() => void handlePaymentOnboardingSuccess()}
      />
    </PageContainer>
  )
}

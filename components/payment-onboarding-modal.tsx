"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useApp } from "@/lib/app-context"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nach erfolgreichem POST; z. B. Instant-Call oder Speichern fortsetzen */
  onSuccess?: () => void
}

export function PaymentOnboardingModal({ open, onOpenChange, onSuccess }: Props) {
  const { t } = useI18n()
  const { refreshProfile } = useApp()
  const [billing, setBilling] = useState(false)
  const [waiver, setWaiver] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = billing && waiver && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/user/payment-onboarding-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPaymentConsent: true, withdrawalWaiver: true }),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Speichern fehlgeschlagen")
      }
      await refreshProfile()
      toast.success(t("paymentOnboarding.success"))
      setBilling(false)
      setWaiver(false)
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("paymentOnboarding.title")}</DialogTitle>
          <DialogDescription>{t("paymentOnboarding.intro")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
            <div className="flex gap-3">
              <Checkbox
                id="p2-billing"
                checked={billing}
                onCheckedChange={(v) => setBilling(v === true)}
                disabled={submitting}
                className="mt-0.5 size-5"
              />
              <Label htmlFor="p2-billing" className="cursor-pointer text-sm leading-snug font-normal">
                {t("paymentOnboarding.billingBody", { provider: t("register.consent.paymentProviderName") })}
              </Label>
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
            <div className="flex gap-3">
              <Checkbox
                id="p2-waiver"
                checked={waiver}
                onCheckedChange={(v) => setWaiver(v === true)}
                disabled={submitting}
                className="mt-0.5 size-5"
              />
              <Label htmlFor="p2-waiver" className="cursor-pointer text-sm leading-snug font-normal">
                {t("paymentOnboarding.waiverBody")}
              </Label>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("paymentOnboarding.dataRoutingHint")}{" "}
            <Link href="/legal/datenschutz" className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
              {t("register.consent.linkPrivacy")}
            </Link>
            .
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()} className="gap-2">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("paymentOnboarding.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

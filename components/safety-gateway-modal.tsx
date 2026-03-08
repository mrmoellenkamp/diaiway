"use client"

/**
 * diaiway Safety Enforcement — Pre-Call-Gateway
 * Blockiert den Call-Start bis alle drei Bestätigungen erfolgt sind.
 */

import { useState } from "react"
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
import { Shield } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface SafetyGatewayModalProps {
  open: boolean
  onConfirm: (snapshotConsent: boolean) => void
  disabled?: boolean
  /** Bei Voice-Call: Video-Snapshot-/Video-Raum-Warnung weglassen */
  isVoiceCall?: boolean
  /** Ist aktueller Nutzer der Shugyo (Bucher)? Nur Shugyo muss Snapshot-Einwilligung geben */
  isBooker?: boolean
}

export function SafetyGatewayModal({ open, onConfirm, disabled, isVoiceCall, isBooker }: SafetyGatewayModalProps) {
  const { t } = useI18n()
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [check3, setCheck3] = useState(false)
  const [check4, setCheck4] = useState(false)

  const needsSnapshot = isVoiceCall !== true && isBooker === true
  const allAccepted = check1 && check2 && check3 && (!needsSnapshot || check4)

  const handleConfirm = () => {
    if (!allAccepted) return
    onConfirm(needsSnapshot ? check4 : false)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2" data-testid="safety-gateway-modal">
            <Shield className="size-6 text-primary" />
            <DialogTitle>{t("safety.gatewayTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {isVoiceCall ? t("safety.gatewayDescVoice") : t("safety.gatewayDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <Checkbox checked={check1} onCheckedChange={(v) => setCheck1(!!v)} />
            <span className="text-sm">{t("safety.checkLiability")}</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <Checkbox checked={check2} onCheckedChange={(v) => setCheck2(!!v)} />
            <span className="text-sm">{t("safety.checkConduct")}</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
            <Checkbox checked={check3} onCheckedChange={(v) => setCheck3(!!v)} />
            <span className="text-sm">{t("safety.checkGoogleSafety")}</span>
          </label>
          {needsSnapshot && (
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
              <Checkbox checked={check4} onCheckedChange={(v) => setCheck4(!!v)} />
              <span className="text-sm">{t("safety.checkSnapshotConsent")}</span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!allAccepted || disabled}>
            {t("safety.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

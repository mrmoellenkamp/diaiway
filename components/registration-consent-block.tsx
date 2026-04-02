"use client"

import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** Phase 1 Registrierung: AGB/Datenschutz + Altersverifikation (Pflicht) + optionales Marketing */
export type RegistrationConsentState = {
  agbPrivacy: boolean
  ageVerification: boolean
  marketing: boolean
}

export const initialRegistrationConsents: RegistrationConsentState = {
  agbPrivacy: false,
  ageVerification: false,
  marketing: false,
}

type Props = {
  value: RegistrationConsentState
  onChange: (next: RegistrationConsentState) => void
  disabled?: boolean
}

export function registrationConsentsComplete(c: RegistrationConsentState): boolean {
  return c.agbPrivacy === true && c.ageVerification === true
}

export function RegistrationConsentBlock({ value, onChange, disabled }: Props) {
  const { t } = useI18n()

  const row = (
    id: string,
    checked: boolean,
    onChecked: (v: boolean) => void,
    label: React.ReactNode,
    required?: boolean,
  ) => (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-[rgba(231,229,227,0.5)] bg-[rgba(250,250,249,0.8)] p-3 shadow-sm transition-colors",
        required && "border-[rgba(6,78,59,0.15)]",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChecked(v === true)}
        disabled={disabled}
        className="mt-0.5 size-5"
        data-testid={id}
      />
      <Label htmlFor={id} className="cursor-pointer text-sm leading-snug font-normal text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(6,78,59,0.1)] bg-[rgba(6,78,59,0.04)] p-4 md:p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{t("register.consent.sectionTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("register.consent.phase1Hint")}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {row(
          "consent-agb-privacy",
          value.agbPrivacy,
          (v) => onChange({ ...value, agbPrivacy: v }),
          <>
            {t("register.consent.agbPrivacyPrefix")}{" "}
            <Link href="/legal/agb" className="font-medium text-primary underline-offset-2 hover:underline" target="_blank" rel="noopener noreferrer">
              {t("register.consent.linkAgb")}
            </Link>{" "}
            {t("register.consent.agbPrivacyMiddleShort")}{" "}
            <Link
              href="/legal/datenschutz"
              className="font-medium text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("register.consent.linkPrivacy")}
            </Link>
            {t("register.consent.agbPrivacySuffixShort")}
          </>,
          true,
        )}

        {row(
          "consent-age-verification",
          value.ageVerification,
          (v) => onChange({ ...value, ageVerification: v }),
          t("register.consent.ageVerification"),
          true,
        )}

        {row(
          "consent-marketing",
          value.marketing,
          (v) => onChange({ ...value, marketing: v }),
          t("register.consent.newsletterShort"),
          false,
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">{t("register.consent.phase1Footer")}</p>
    </div>
  )
}

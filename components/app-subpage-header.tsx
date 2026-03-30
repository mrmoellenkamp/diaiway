"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

/**
 * Einheitlicher Unterseiten-Header: Zurück (←) + Titel in einer Zeile (min-height),
 * optional Untertitel darunter (eingerückt unter dem Titel).
 */
export function AppSubpageHeader({
  title,
  backHref = "/profile",
  subtitle,
  className,
  backAriaLabel,
  trailing,
}: {
  title: string
  backHref?: string
  subtitle?: string
  className?: string
  /** Falls gesetzt, statt „Zurück“ (z. B. „Zurück zum Profil“) */
  backAriaLabel?: string
  trailing?: ReactNode
}) {
  const { t } = useI18n()
  const ariaBack = backAriaLabel ?? t("common.back")
  return (
    <header className={cn("flex flex-col gap-1", className)}>
      <div className="flex min-h-12 items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="shrink-0 -ml-2 touch-manipulation">
          <Link href={backHref} aria-label={ariaBack}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-foreground">{title}</h1>
        {trailing ? (
          <div className="shrink-0 max-w-[45%] text-right">{trailing}</div>
        ) : null}
      </div>
      {subtitle ? (
        <p className="-mt-0.5 pl-10 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </header>
  )
}

export function LegalSubpageHeader({
  variant,
  className,
}: {
  variant: "privacy" | "imprint"
  className?: string
}) {
  const { t } = useI18n()
  const cfg =
    variant === "privacy"
      ? { title: "legal.privacyTitle" as const, subtitle: "legal.privacySubtitle" as const }
      : { title: "legal.imprintTitle" as const, subtitle: "legal.imprintSubtitle" as const }
  return <AppSubpageHeader className={className} title={t(cfg.title)} subtitle={t(cfg.subtitle)} />
}

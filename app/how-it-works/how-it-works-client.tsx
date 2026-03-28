"use client"

import type { ComponentType, ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, Compass, Handshake, Shield, Sparkles } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export function HowItWorksClient() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg min-w-0 px-4 py-6 pb-safe">
        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/"
            aria-label={t("howItWorks.backAria")}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{t("footer.howItWorks")}</h1>
            <p className="text-xs text-muted-foreground">{t("howItWorks.pageSubtitle")}</p>
          </div>
        </div>

        <section className="relative mb-10 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/[0.08] via-background to-background p-6 shadow-sm">
          <div className="pointer-events-none absolute -right-12 top-0 size-32 rounded-full bg-primary/10 blur-2xl" aria-hidden />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <Compass className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="text-sm font-semibold text-primary">{t("howItWorks.introBadge")}</span>
            </div>
            <h2 className="mb-3 text-xl font-bold leading-tight tracking-tight text-foreground">
              {t("howItWorks.introTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("howItWorks.introP1")}
              <strong className="font-medium text-foreground">{t("howItWorks.introShugyo")}</strong>
              {t("howItWorks.introP2")}
              <strong className="font-medium text-foreground">{t("howItWorks.introTakumi")}</strong>
              {t("howItWorks.introP3")}
            </p>
          </div>
        </section>

        <section className="mb-10" aria-labelledby="how-it-works-concepts-heading">
          <h2 id="how-it-works-concepts-heading" className="mb-4 text-lg font-bold text-foreground">
            {t("landing.conceptsHeading")}
          </h2>
          <div className="flex flex-col gap-4">
            <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold leading-snug text-foreground">
                {t("landing.conceptHishoTitle")}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("landing.conceptHishoLead")}
                <strong className="font-medium text-foreground">{t("landing.conceptHishoEmphasis")}</strong>
                {t("landing.conceptHishoTail")}
              </p>
            </article>
            <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold leading-snug text-foreground">
                {t("landing.conceptShugyoTitle")}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("landing.conceptShugyoBody")}</p>
            </article>
            <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold leading-snug text-foreground">
                {t("landing.conceptTakumiTitle")}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("landing.conceptTakumiBody")}</p>
            </article>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <StepCard
            step={1}
            icon={Sparkles}
            stepLabel={t("landing.step")}
            title={t("howItWorks.step1Title")}
            body={
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("howItWorks.step1Before")}
                <strong className="font-medium text-foreground">{t("howItWorks.step1EmText")}</strong>
                {t("howItWorks.step1Or")}
                <strong className="font-medium text-foreground">{t("howItWorks.step1EmBilder")}</strong>
                {t("howItWorks.step1Mid")}
                <strong className="font-medium text-foreground">{t("howItWorks.step1EmTakumi")}</strong>
                {t("howItWorks.step1After")}
              </p>
            }
          />
          <StepCard
            step={2}
            icon={Handshake}
            stepLabel={t("landing.step")}
            title={t("howItWorks.step2Title")}
            body={<p className="text-sm leading-relaxed text-muted-foreground">{t("landing.reasonHandshakeDesc")}</p>}
          />
          <StepCard
            step={3}
            icon={Shield}
            stepLabel={t("landing.step")}
            title={t("howItWorks.step3Title")}
            body={
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("howItWorks.step3Before")}
                <strong className="font-medium text-foreground">{t("howItWorks.step3EmEscrow")}</strong>
                {t("howItWorks.step3After")}
              </p>
            }
          />
        </div>

        <div className="mt-10 flex flex-col gap-4">
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("howItWorks.ctaStart")}
          </Link>
          <Link
            href="/"
            className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("howItWorks.ctaHome")}
          </Link>
        </div>
      </main>
    </div>
  )
}

function StepCard({
  step,
  icon: Icon,
  stepLabel,
  title,
  body,
}: {
  step: number
  icon: ComponentType<{ className?: string }>
  stepLabel: string
  title: string
  body: ReactNode
}) {
  return (
    <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            {stepLabel} {step}
          </span>
          <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{title}</h3>
          <div className="mt-2">{body}</div>
        </div>
      </div>
    </article>
  )
}

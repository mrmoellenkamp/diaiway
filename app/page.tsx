"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { hardSignOut } from "@/lib/hard-sign-out-client"
import Image from "next/image"
import { Capacitor } from "@capacitor/core"
import { getStayLoggedIn } from "@/hooks/use-native-bridge"
import { Button } from "@/components/ui/button"
import { CategoryCard } from "@/components/category-card"
import { useCategories } from "@/lib/categories-i18n"
import { useTakumis } from "@/hooks/use-takumis"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import {
  ArrowRight,
  Video,
  Shield,
  CheckCircle,
  Star,
  Sparkles,
  BadgeCheck,
  Handshake,
  CircleDollarSign,
  Globe2,
  Award,
  Info,
  BookOpen,
  Ban,
  CalendarDays,
  DoorOpen,
} from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { takumiPublicLabel } from "@/lib/communication-display"

function TakumiBenefitsSection() {
  const { t } = useI18n()
  return (
    <section
      className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12"
      aria-labelledby="landing-takumi-benefits-heading"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[rgba(6,78,59,0.2)] bg-gradient-to-b from-[rgba(6,78,59,0.06)] via-background to-background p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 top-0 size-40 rounded-full bg-[rgba(6,78,59,0.1)] blur-3xl" aria-hidden />
        <div className="relative">
          <h2 id="landing-takumi-benefits-heading" className="mb-3 text-lg font-bold tracking-tight text-foreground">
            {t("landing.takumiBenefitsHeading")}
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            {t("landing.takumiBenefitsIntroA")}
            <strong className="font-medium text-foreground">{t("landing.takumiBenefitsIntroPlatform")}</strong>
            {t("landing.takumiBenefitsIntroB")}
            <strong className="font-medium text-foreground">{t("landing.takumiBenefitsIntroRole")}</strong>
            {t("landing.takumiBenefitsIntroC")}
          </p>
          <div className="flex flex-col gap-4">
            <article className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-[rgba(255,255,255,0.9)] p-4 shadow-sm backdrop-blur-sm">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(6,78,59,0.1)]">
                  <CircleDollarSign className="size-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">
                    {t("landing.takumiBenefitMoneyTitle")}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("landing.takumiBenefitMoneyIntro")}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-4 text-left marker:text-[rgba(6,78,59,0.6)]">
                    {(
                      [
                        ["landing.takumiBenefitMoneyLi1Label", "landing.takumiBenefitMoneyLi1Body"],
                        ["landing.takumiBenefitMoneyLi2Label", "landing.takumiBenefitMoneyLi2Body"],
                        ["landing.takumiBenefitMoneyLi3Label", "landing.takumiBenefitMoneyLi3Body"],
                        ["landing.takumiBenefitMoneyLi4Label", "landing.takumiBenefitMoneyLi4Body"],
                      ] as const
                    ).map(([lk, bk]) => (
                      <li key={lk} className="text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">{t(lk)}</span> {t(bk)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
            <article className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-[rgba(255,255,255,0.9)] p-4 shadow-sm backdrop-blur-sm">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(6,78,59,0.1)]">
                  <Globe2 className="size-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">
                    {t("landing.takumiBenefitFlexTitle")}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("landing.takumiBenefitFlexIntro")}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-4 marker:text-[rgba(6,78,59,0.6)]">
                    <li className="text-xs leading-relaxed text-muted-foreground">{t("landing.takumiBenefitFlexLi1")}</li>
                    <li className="text-xs leading-relaxed text-muted-foreground">{t("landing.takumiBenefitFlexLi2")}</li>
                  </ul>
                </div>
              </div>
            </article>
            <article className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-[rgba(255,255,255,0.9)] p-4 shadow-sm backdrop-blur-sm">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(6,78,59,0.1)]">
                  <Award className="size-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">
                    {t("landing.takumiBenefitRepTitle")}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("landing.takumiBenefitRepIntro")}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-4 text-left marker:text-[rgba(6,78,59,0.6)]">
                    <li className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{t("landing.takumiBenefitRepLi1Label")}</span>{" "}
                      {t("landing.takumiBenefitRepLi1Body")}
                    </li>
                    <li className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{t("landing.takumiBenefitRepLi2Label")}</span>{" "}
                      {t("landing.takumiBenefitRepLi2Body")}
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Verzögert Takumis-Fetch: Erst nach Hero-Render, damit LCP nicht blockiert */
function LiveTakumisSection() {
  const { takumis } = useTakumis()
  const liveTakumis = takumis.filter((t) => t.isLive)
  const { t } = useI18n()
  return (
    <section className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12">
      <p className="font-jp text-4xl text-center text-[rgba(120,113,108,0.5)] mb-6">匠</p>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{t("landing.nowAvailable")}</h2>
        {liveTakumis.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-accent font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-accent" />
            </span>
            {liveTakumis.length} {t("landing.live")}
          </span>
        )}
      </div>
      {liveTakumis.length > 0 ? (
        <div className="flex flex-col gap-3">
          {liveTakumis.slice(0, 3).map((tk) => (
            <div key={tk.id} className="flex items-center gap-3 rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-3">
              <Avatar className="size-10 border-2 border-[rgba(34,197,94,0.22)]">
                {tk.imageUrl && <AvatarImage src={tk.imageUrl} alt={takumiPublicLabel(tk)} className="object-cover" />}
                <AvatarFallback className="bg-[rgba(34,197,94,0.12)] text-accent font-semibold text-xs">
                  {tk.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{takumiPublicLabel(tk)}</span>
                <span className="text-xs text-muted-foreground">{tk.subcategory}</span>
              </div>
              <Button asChild size="sm" className="rounded-lg bg-accent text-accent-foreground hover:bg-[rgba(34,197,94,0.9)] h-8 text-xs">
                <Link href={`/takumi/${tk.id}`}>{t("landing.connect")}</Link>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("landing.noExpertsOnline")}</p>
        </div>
      )}
    </section>
  )
}

export default function LandingPage() {
  const { data: session, status } = useSession()
  const isLoggedIn = !!session?.user
  /** Erst nach mount: vermeidet React #418 (SSR kennt Session oft nicht, Client schon). */
  const [ctaHydrationSafe, setCtaHydrationSafe] = useState(false)
  const [showTakumis, setShowTakumis] = useState(false)
  const categories = useCategories()
  const { t } = useI18n()
  const showLoggedInCta = ctaHydrationSafe && isLoggedIn

  /**
   * Native Landing: stay-preference nur **einmal pro WebView-Lebensdauer** anwenden.
   * Sonst: Nach Login erneut `/` (Logo „Start“) → bei stay=false sofort wieder signOut → Bootloop-Gefühl.
   * Neuer App-Prozess = leeres sessionStorage → Cold-Start-Verhalten bleibt wie gewünscht.
   */
  const NATIVE_LANDING_GATE = "diaiway_native_landing_stay_handled"

  // Native: "stay yes" → redirect to profile; "stay no" → sign out and show login; null → normal landing
  useEffect(() => {
    if (status !== "authenticated" || !session?.user || !Capacitor.isNativePlatform()) return
    let cancelled = false
    ;(async () => {
      try {
        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(NATIVE_LANDING_GATE)) return
        const stay = await getStayLoggedIn()
        if (cancelled) return
        if (stay === true) {
          if (typeof sessionStorage !== "undefined") sessionStorage.setItem(NATIVE_LANDING_GATE, "1")
          const role = (session.user as { role?: string })?.role ?? "user"
          const appRole = (session.user as { appRole?: string })?.appRole ?? "shugyo"
          const target = role === "admin" ? "/admin" : appRole === "takumi" ? "/profile" : "/categories"
          window.location.replace(target)
        } else if (stay === false) {
          if (typeof sessionStorage !== "undefined") sessionStorage.setItem(NATIVE_LANDING_GATE, "1")
          // User chose "always show login" → sign out so they see login page with Face ID
          if (!cancelled) await hardSignOut("/login")
        }
      } catch {
        /* Preferences fehlgeschlagen — normale Landing anzeigen */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, session?.user])

  useEffect(() => {
    setCtaHydrationSafe(true)
    const id = setTimeout(() => setShowTakumis(true), 400)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero Section */}
      <section className="relative flex flex-col overflow-hidden bg-primary">
        <div className="relative w-full aspect-[16/9] min-h-[min(18rem,40vh)] max-h-[min(26rem,50vh)]">
          <Image
            src="/images/hero-landing.png"
            alt="diAiway - Expert video consultation platform"
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary to-transparent pointer-events-none" />

        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 pb-10 pt-2 text-center sm:px-6">
          <h1 className="text-balance text-center text-3xl font-bold leading-tight tracking-tight text-[rgb(240,253,244)]">
            <span className="block">{t("landing.heroTitle")}</span>
            <span className="mt-2 block text-lg font-semibold leading-snug tracking-tight text-[rgba(240,253,244,0.92)] sm:text-xl">
              {t("landing.heroIntro")}
            </span>
          </h1>
          <p className="font-jp text-4xl text-[rgba(34,197,94,0.85)]">匠</p>

          <h2 className="text-base font-semibold text-[rgb(240,253,244)]">
            {t("landing.heroWaysTitle")}
          </h2>
          <div className="flex w-full flex-col gap-4">
            {/* rgba statt bg-…/5: ältere Android-WebViews ignorieren color-mix → sonst fast weiße Karten */}
            <div className="flex flex-col gap-2 rounded-xl bg-[rgba(240,253,244,0.08)] p-4 text-left">
              <p className="text-pretty text-sm leading-relaxed text-[rgba(240,253,244,0.9)]">
                <span className="font-medium">1.</span> {t("landing.heroWay1")}
              </p>
              <Button asChild size="lg" className="h-auto min-h-12 w-full rounded-xl bg-accent py-3 pr-11 text-base font-bold text-accent-foreground hover:bg-[rgba(34,197,94,0.9)] shadow-md">
                <Link href="/ai-guide" className="relative block text-center">
                  <span className="whitespace-pre-line leading-snug">{t("landing.heroWay1Button")}</span>
                  <ArrowRight className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-[rgba(240,253,244,0.08)] p-4 text-left">
              <p className="text-pretty text-sm leading-relaxed text-[rgba(240,253,244,0.9)]">
                <span className="font-medium">2.</span> {t("landing.heroWay2")}
              </p>
              <Button asChild size="lg" className="h-12 w-full rounded-xl bg-accent text-base font-bold text-accent-foreground hover:bg-[rgba(34,197,94,0.9)] shadow-md">
                <Link href="/categories">
                  {t("landing.heroWay2Button")}
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2">
            <p className="text-pretty text-sm font-medium leading-relaxed text-[rgba(34,197,94,0.92)]">
              {t("landing.heroTakumiCta")}
            </p>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-xl border-[rgba(240,253,244,0.35)] bg-transparent text-base font-semibold text-[rgb(240,253,244)] hover:bg-[rgba(240,253,244,0.12)]"
            >
              <Link href="/register?role=takumi">{t("landing.heroTakumiButton")}</Link>
            </Button>
          </div>

          <div className="flex items-center gap-4 pt-2 text-xs text-[rgba(240,253,244,0.58)]">
            <span className="flex items-center gap-1">
              <CheckCircle className="size-3" />
              {t("landing.freeMinutes")}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="size-3" />
              {t("landing.noSubscription")}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="size-3" />
              {t("landing.gdprCompliant")}
            </span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* 匠 + Live Takumis (verzögert geladen für schnelleren LCP) */}
      {showTakumis ? <LiveTakumisSection /> : (
        <section className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12">
          <p className="font-jp text-4xl text-center text-[rgba(120,113,108,0.5)] mb-6">匠</p>
          <h2 className="mb-4 text-lg font-bold text-foreground">{t("landing.nowAvailable")}</h2>
          <div className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-4" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </section>
      )}

      {/* Categories Preview */}
      <section className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t("common.categories")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.slice(0, 6).map((cat) => (
            <CategoryCard key={cat.slug} category={cat} />
          ))}
        </div>
        <div className="mt-4 text-center">
          <Button asChild variant="ghost" className="text-sm text-primary">
            <Link href="/categories">
              {t("landing.allCategories", { count: categories.length })}
              <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Hisho, Shugyo, Takumi – unter Kategorien, über „Warum diAiway“ */}
      <section className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12" aria-labelledby="landing-concepts-heading">
        <h2 id="landing-concepts-heading" className="mb-4 text-lg font-bold text-foreground">
          {t("landing.conceptsHeading")}
        </h2>
        <div className="flex flex-col gap-4">
          <article className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground leading-snug">
              {t("landing.conceptHishoTitle")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("landing.conceptHishoLead")}
              <strong className="font-medium text-foreground">{t("landing.conceptHishoEmphasis")}</strong>
              {t("landing.conceptHishoTail")}
            </p>
          </article>
          <article className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground leading-snug">
              {t("landing.conceptShugyoTitle")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t("landing.conceptShugyoBody")}</p>
          </article>
          <article className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground leading-snug">
              {t("landing.conceptTakumiTitle")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t("landing.conceptTakumiBody")}</p>
          </article>
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12"
        aria-labelledby="landing-who-takumi-heading"
      >
        <h2 id="landing-who-takumi-heading" className="mb-4 text-lg font-bold text-foreground">
          {t("landing.whoTakumiTitle")}
        </h2>
        <article className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4 shadow-sm sm:p-5">
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("landing.whoTakumiP1")}
            <strong className="font-medium text-foreground">{t("landing.whoTakumiEmPro")}</strong>
            {t("landing.whoTakumiP2")}
            <strong className="font-medium text-foreground">{t("landing.whoTakumiEmHobby")}</strong>
            {t("landing.whoTakumiP3")}
            <strong className="font-medium text-foreground">{t("landing.whoTakumiEmSpirit")}</strong>
            {t("landing.whoTakumiP4")}
          </p>
        </article>
      </section>

      {/* Trust Section */}
      <section className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t("landing.whyDiaiway")}</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: Sparkles, title: t("landing.reasonIndividualTitle"), desc: t("landing.reasonIndividualDesc") },
            { icon: Video, title: t("landing.reasonLiveSessionsTitle"), desc: t("landing.reasonLiveSessionsDesc") },
            { icon: CalendarDays, title: t("landing.reasonFlexibleTitle"), desc: t("landing.reasonFlexibleDesc") },
            { icon: DoorOpen, title: t("landing.reasonOpenDoorTitle"), desc: t("landing.reasonOpenDoorDesc") },
            { icon: BadgeCheck, title: t("landing.reasonExpertsTitle"), desc: t("landing.reasonExpertsDesc") },
            { icon: Star, title: t("landing.reasonQualityTitle"), desc: t("landing.reasonQualityDesc") },
            { icon: Handshake, title: t("landing.reasonHandshakeTitle"), desc: t("landing.reasonHandshakeDesc") },
            { icon: Shield, title: t("landing.reasonEscrowTitle"), desc: t("landing.reasonEscrowDesc") },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(6,78,59,0.1)]">
                <item.icon className="size-5 text-primary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12"
        aria-labelledby="landing-diaiway-is-heading landing-diaiway-not-heading"
      >
        <div className="flex flex-col gap-4">
          <article className="overflow-hidden rounded-xl border border-[rgba(231,229,227,0.6)] bg-card shadow-sm">
            <div className="flex min-h-0">
              <div className="w-1 shrink-0 bg-primary" aria-hidden />
              <div className="flex min-w-0 flex-1 gap-3 p-4 sm:gap-4 sm:p-5">
                <BookOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <h2
                    id="landing-diaiway-is-heading"
                    className="text-base font-bold leading-snug tracking-tight text-foreground"
                  >
                    {t("landing.diaiwayManifestoIsTitle")}
                  </h2>
                  <p className="mt-2.5 text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {t("landing.diaiwayManifestoIsBody")}
                  </p>
                </div>
              </div>
            </div>
          </article>
          <article className="overflow-hidden rounded-xl border border-[rgba(231,229,227,0.6)] bg-[rgba(245,245,244,0.25)] shadow-sm">
            <div className="flex min-h-0">
              <div className="w-1 shrink-0 bg-[rgba(120,113,108,0.35)]" aria-hidden />
              <div className="flex min-w-0 flex-1 gap-3 p-4 sm:gap-4 sm:p-5">
                <Ban className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <h2
                    id="landing-diaiway-not-heading"
                    className="text-base font-bold leading-snug tracking-tight text-foreground"
                  >
                    {t("landing.diaiwayManifestoNotTitle")}
                  </h2>
                  <p className="mt-2.5 text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {t("landing.diaiwayManifestoNotBody")}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-lg px-4 pb-6 sm:px-6 sm:pb-8"
        aria-label={t("landing.takumiExpectationsAria")}
      >
        <aside className="flex gap-3 rounded-xl border border-[rgba(231,229,227,0.8)] bg-[rgba(245,245,244,0.35)] p-4 shadow-sm sm:p-5">
          <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("landing.takumiExpectationsBody")}
          </p>
        </aside>
      </section>

      <TakumiBenefitsSection />

      {/* CTA */}
      <section className="mx-auto w-full max-w-lg px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="rounded-2xl bg-primary p-8 text-center">
          <p className="font-jp text-3xl text-[rgba(34,197,94,0.72)] mb-3">道</p>
          <h2 className="text-xl font-bold text-[rgb(240,253,244)] mb-2">
            {showLoggedInCta ? t("landing.ctaTitleLoggedIn") : t("landing.ctaTitleLoggedOut")}
          </h2>
          <p className="text-sm text-[rgba(240,253,244,0.78)] mb-6">
            {showLoggedInCta ? t("landing.ctaDescLoggedIn") : t("landing.ctaDescLoggedOut")}
          </p>
          <Button
            asChild
            size="lg"
            className="h-12 w-full rounded-xl bg-accent font-bold text-accent-foreground hover:bg-[rgba(34,197,94,0.9)]"
          >
            <Link href={showLoggedInCta ? "/categories" : "/register"}>
              {showLoggedInCta ? t("landing.discoverCategories") : t("landing.getStarted")}
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer — 4-Spalten-Struktur: Entdecken, Support, Legal, Mission */}
      <footer className="border-t border-border bg-card px-4 py-8 sm:px-6" aria-label="Footer">
        <div className="mx-auto w-full max-w-lg">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-left">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.discover")}
              </span>
              <Link href="/how-it-works" className="text-xs text-muted-foreground hover:text-foreground">
                {t("footer.howItWorks")}
              </Link>
              <Link href="/categories" className="text-xs text-muted-foreground hover:text-foreground">
                {t("footer.categories")}
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.support")}
              </span>
              <Link href="/help" className="text-xs text-muted-foreground hover:text-foreground">
                {t("footer.helpSupport")}
              </Link>
              <Link href="/help#faq" className="text-xs text-muted-foreground hover:text-foreground">
                {t("footer.faq")}
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.legal")}
              </span>
              <Link href="/legal/impressum" className="text-xs text-muted-foreground hover:text-foreground">
                {t("footer.imprint")}
              </Link>
              <Link href="/legal/datenschutz" className="text-xs text-muted-foreground hover:text-foreground">
                {t("footer.privacy")}
              </Link>
              <Link href="/legal/agb" className="text-xs text-muted-foreground hover:text-foreground">
                {t("landing.terms")}
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.mission")}
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("footer.missionText")}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-1 border-t border-[rgba(231,229,227,0.4)] pt-6 text-center">
            <span className="text-sm font-semibold text-foreground">
              di<span className="text-accent">Ai</span>way
            </span>
            <p className="text-xs text-muted-foreground">{t("landing.copyright")}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

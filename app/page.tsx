"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import Image from "next/image"
import { Capacitor } from "@capacitor/core"
import { getStayLoggedIn } from "@/hooks/use-native-bridge"
import { Button } from "@/components/ui/button"
import { CategoryCard } from "@/components/category-card"
import { useCategories } from "@/lib/categories-i18n"
import { useTakumis } from "@/hooks/use-takumis"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { ArrowRight, Video, Shield, CheckCircle, Star } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { takumiPublicLabel } from "@/lib/communication-display"

/** Verzögert Takumis-Fetch: Erst nach Hero-Render, damit LCP nicht blockiert */
function LiveTakumisSection() {
  const { takumis } = useTakumis()
  const liveTakumis = takumis.filter((t) => t.isLive)
  const { t } = useI18n()
  return (
    <section className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12">
      <p className="font-jp text-4xl text-center text-muted-foreground/50 mb-6">匠</p>
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
            <div key={tk.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <Avatar className="size-10 border-2 border-accent/20">
                <AvatarFallback className="bg-accent/10 text-accent font-semibold text-xs">
                  {tk.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{takumiPublicLabel(tk)}</span>
                <span className="text-xs text-muted-foreground">{tk.subcategory}</span>
              </div>
              <Button asChild size="sm" className="rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 h-8 text-xs">
                <Link href={`/takumi/${tk.id}`}>{t("landing.connect")}</Link>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("landing.noExpertsOnline")}</p>
        </div>
      )}
    </section>
  )
}

export default function LandingPage() {
  const { data: session, status } = useSession()
  const isLoggedIn = !!session?.user
  const [showTakumis, setShowTakumis] = useState(false)
  const categories = useCategories()
  const { t } = useI18n()

  // Native: "stay yes" → redirect to profile; "stay no" → sign out and show login; null → normal landing
  useEffect(() => {
    if (status !== "authenticated" || !session?.user || !Capacitor.isNativePlatform()) return
    ;(async () => {
      const stay = await getStayLoggedIn()
      if (stay === true) {
        const role = (session.user as { role?: string })?.role ?? "user"
        const appRole = (session.user as { appRole?: string })?.appRole ?? "shugyo"
        const target = role === "admin" ? "/admin" : appRole === "takumi" ? "/profile" : "/categories"
        window.location.replace(target)
      } else if (stay === false) {
        // User chose "always show login" → sign out so they see login page with Face ID
        await signOut({ redirect: false })
        window.location.replace("/login")
      }
      // stay === null: never chosen, show landing page normally
    })()
  }, [status, session?.user])

  useEffect(() => {
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
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 pb-10 pt-2 text-center sm:px-6">
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-primary-foreground">
            {t("landing.heroTitle")}
          </h1>
          <p className="font-jp text-4xl text-accent/80">匠</p>
          <p className="text-pretty text-sm leading-relaxed text-primary-foreground/70">
            {t("landing.heroIntro")}
          </p>
          <h2 className="text-base font-semibold text-primary-foreground">
            {t("landing.heroWaysTitle")}
          </h2>
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-xl bg-primary-foreground/5 p-4 text-left">
              <p className="text-pretty text-sm leading-relaxed text-primary-foreground/80">
                <span className="font-medium">1.</span> {t("landing.heroWay1")}
              </p>
              <Button asChild size="lg" className="h-12 w-full rounded-xl bg-accent text-base font-bold text-accent-foreground hover:bg-accent/90 shadow-md">
                <Link href="/ai-guide">
                  {t("landing.heroWay1Button")}
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-primary-foreground/5 p-4 text-left">
              <p className="text-pretty text-sm leading-relaxed text-primary-foreground/80">
                <span className="font-medium">2.</span> {t("landing.heroWay2")}
              </p>
              <Button asChild size="lg" className="h-12 w-full rounded-xl bg-accent text-base font-bold text-accent-foreground hover:bg-accent/90 shadow-md">
                <Link href="/categories">
                  {t("landing.heroWay2Button")}
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2">
            <p className="text-pretty text-sm font-medium leading-relaxed text-accent/90">
              {t("landing.heroTakumiCta")}
            </p>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-xl border-primary-foreground/30 bg-transparent text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link href="/register?role=takumi">{t("landing.heroTakumiButton")}</Link>
            </Button>
          </div>

          <div className="flex items-center gap-4 pt-2 text-xs text-primary-foreground/50">
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
          <p className="font-jp text-4xl text-center text-muted-foreground/50 mb-6">匠</p>
          <h2 className="mb-4 text-lg font-bold text-foreground">{t("landing.nowAvailable")}</h2>
          <div className="rounded-xl border border-border/60 bg-card p-6 animate-pulse">
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

      {/* Trust Section */}
      <section className="mx-auto w-full max-w-lg px-4 pb-10 sm:px-6 sm:pb-12">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t("landing.whyDiaiway")}</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: Shield, title: t("landing.escrowTitle"), desc: t("landing.escrowDesc") },
            { icon: Video, title: t("landing.liveVideoTitle"), desc: t("landing.liveVideoDesc") },
            { icon: Star, title: t("landing.verifiedTitle"), desc: t("landing.verifiedDesc") },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
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

      {/* CTA */}
      <section className="mx-auto w-full max-w-lg px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="rounded-2xl bg-primary p-8 text-center">
          <p className="font-jp text-3xl text-accent/70 mb-3">道</p>
          <h2 className="text-xl font-bold text-primary-foreground mb-2">
            {isLoggedIn ? t("landing.ctaTitleLoggedIn") : t("landing.ctaTitleLoggedOut")}
          </h2>
          <p className="text-sm text-primary-foreground/70 mb-6">
            {isLoggedIn ? t("landing.ctaDescLoggedIn") : t("landing.ctaDescLoggedOut")}
          </p>
          <Button
            asChild
            size="lg"
            className="h-12 w-full rounded-xl bg-accent font-bold text-accent-foreground hover:bg-accent/90"
          >
            <Link href={isLoggedIn ? "/categories" : "/register"}>
              {isLoggedIn ? t("landing.discoverCategories") : t("landing.getStarted")}
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
          <div className="mt-6 flex flex-col items-center gap-1 border-t border-border/40 pt-6 text-center">
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

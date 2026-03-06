"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { CategoryCard } from "@/components/category-card"
import { MentorChat } from "@/components/mentor-chat"
import { categories } from "@/lib/categories"
import { useTakumis } from "@/hooks/use-takumis"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { ArrowRight, Video, Shield, Zap, CheckCircle, Sparkles, Star } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function LandingPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const { takumis } = useTakumis()
  const liveTakumis = takumis.filter((t) => t.isLive)
  const { t } = useI18n()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero Section */}
      <section className="relative flex flex-col overflow-hidden bg-primary">
        <div className="relative w-full aspect-[16/9] min-h-[280px] max-h-[420px]">
          <Image
            src="/images/hero-landing.png"
            alt="diAiway - Expert video consultation platform"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-5 px-6 pb-10 pt-2 text-center">
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-primary-foreground">
            {t("landing.heroTitle")}
          </h1>
          <p className="font-jp text-4xl text-accent/80">匠</p>
          <p className="text-pretty text-sm leading-relaxed text-primary-foreground/70">
            {t("landing.heroDesc")}
          </p>

          <div className="flex w-full flex-col gap-3 pt-1">
            <Button
              asChild
              size="lg"
              className="h-14 w-full rounded-xl bg-accent text-base font-bold text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20"
            >
              <Link href={isLoggedIn ? "/categories" : "/register"}>
                {isLoggedIn ? t("landing.discoverCategories") : t("landing.findExpert")}
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            {!isLoggedIn && (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 w-full rounded-xl border-primary-foreground/20 bg-transparent text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/register?role=takumi">{t("landing.becomeTakumi")}</Link>
              </Button>
            )}
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

      {/* Mentor Chat */}
      <section className="mx-auto max-w-md px-4 pt-14 pb-6">
        <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-3.5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {t("landing.mentorTitle")}
              <span className="font-jp ml-1.5 text-xs font-normal text-primary/30">{"導師"}</span>
            </h2>
          </div>
          <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            {t("landing.mentorDesc")}
          </p>
        </div>
        <MentorChat variant="embedded" />
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-lg px-6 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
          {t("landing.howItWorks")}
        </h2>
        <div className="flex flex-col gap-6">
          {[
            { icon: Zap, step: "1", title: t("landing.step1Title"), desc: t("landing.step1Desc") },
            { icon: Video, step: "2", title: t("landing.step2Title"), desc: t("landing.step2Desc") },
            { icon: Shield, step: "3", title: t("landing.step3Title"), desc: t("landing.step3Desc") },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="size-5 text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-accent">
                  {t("landing.step")} {item.step}
                </span>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Takumis */}
      <section className="mx-auto max-w-lg px-6 pb-12">
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
                  <span className="text-sm font-semibold text-foreground">{tk.name}</span>
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
            <p className="font-jp text-2xl text-muted-foreground/30 mb-2">匠</p>
            <p className="text-sm text-muted-foreground">{t("landing.noExpertsOnline")}</p>
          </div>
        )}
      </section>

      {/* Categories Preview */}
      <section className="mx-auto max-w-lg px-6 pb-12">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t("common.categories")}</h2>
        <div className="grid grid-cols-3 gap-2">
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
      <section className="mx-auto max-w-lg px-6 pb-12">
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
      <section className="mx-auto max-w-lg px-6 pb-16">
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

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-8">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
          <span className="text-sm font-semibold text-foreground">
            di<span className="text-accent">Ai</span>way
          </span>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/legal/impressum" className="hover:text-foreground">{t("landing.imprint")}</Link>
            <Link href="/legal/datenschutz" className="hover:text-foreground">{t("landing.privacy")}</Link>
            <Link href="/legal/agb" className="hover:text-foreground">{t("landing.terms")}</Link>
          </div>
          <p className="text-xs text-muted-foreground">{t("landing.copyright")}</p>
        </div>
      </footer>
    </div>
  )
}

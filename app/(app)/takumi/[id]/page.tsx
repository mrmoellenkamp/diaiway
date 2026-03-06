"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LiveBadge } from "@/components/live-badge"
import { ReviewStars } from "@/components/review-stars"
import { PageContainer } from "@/components/page-container"
import { useTakumis } from "@/hooks/use-takumis"
import { useApp } from "@/lib/app-context"
import { notFound } from "next/navigation"
import {
  ArrowLeft, CheckCircle, Clock, Video, MessageSquare, Shield, Star, Loader2, Send, Mail,
} from "lucide-react"

export default function TakumiProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { takumis } = useTakumis()
  const takumi = takumis.find((t) => t.id === id)
  if (!takumi) notFound()

  const { openMentorWithTakumi, sendDirectMessage } = useApp()
  const router = useRouter()
  const [isContacting, setIsContacting] = useState(false)
  const [isDmSending, setIsDmSending] = useState(false)
  const [dmSent, setDmSent] = useState(false)

  function handleContact() {
    setIsContacting(true)
    setTimeout(() => {
      openMentorWithTakumi(takumi.id, takumi.name)
      setIsContacting(false)
    }, 600)
  }

  function handleDirectMessage() {
    setIsDmSending(true)
    setTimeout(() => {
      sendDirectMessage(
        takumi.id,
        takumi.name,
        takumi.avatar,
        takumi.subcategory,
        `Hallo ${takumi.name.split(" ")[0]}, ich habe dein Profil gesehen und wurde gerne mit dir uber mein Projekt sprechen.`
      )
      setIsDmSending(false)
      setDmSent(true)
      setTimeout(() => router.push("/messages"), 800)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Cover Area */}
      <div className="relative h-36 bg-gradient-to-br from-primary via-primary to-primary/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(34,197,94,0.2)_0%,_transparent_60%)]" />
        <Link
          href="/home"
          className="absolute left-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm"
        >
          <ArrowLeft className="size-4 text-white" />
        </Link>
      </div>

      <PageContainer className="-mt-12 relative z-10">
        <div className="flex flex-col gap-6">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar className="size-24 border-4 border-card shadow-lg">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                {takumi.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{takumi.name}</h1>
                {takumi.verified && <CheckCircle className="size-4 text-accent" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-jp text-sm text-primary/60">匠</span>
                {takumi.isPro && (
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none">PRO</Badge>
                )}
                {takumi.isLive && <LiveBadge size="md" />}
              </div>
              <p className="text-sm text-muted-foreground">
                {takumi.categoryName} &middot; {takumi.subcategory}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sessions", value: takumi.sessionCount.toString(), icon: Video },
              { label: "Bewertung", value: takumi.rating.toString(), icon: Star },
              { label: "Antwortzeit", value: takumi.responseTime, icon: Clock },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card p-3">
                <stat.icon className="size-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{stat.value}</span>
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">Uber mich</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{takumi.bio}</p>
          </div>

          {/* Portfolio Placeholder */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">Portfolio</h2>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-muted flex items-center justify-center"
                >
                  <span className="text-xs text-muted-foreground">Bild {i}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            {/* AI Mentor Contact */}
            <Button
              onClick={handleContact}
              disabled={isContacting}
              className="h-12 w-full gap-2.5 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-70"
            >
              {isContacting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Chat wird vorbereitet...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Jetzt Nachricht schreiben
                </>
              )}
            </Button>
            {/* Direct Message to Expert */}
            <Button
              onClick={handleDirectMessage}
              disabled={isDmSending || dmSent}
              variant="outline"
              className="h-11 w-full gap-2.5 rounded-xl border-primary/20 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-70"
            >
              {dmSent ? (
                <>
                  <CheckCircle className="size-4 text-accent" />
                  Nachricht gesendet!
                </>
              ) : isDmSending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Mail className="size-4" />
                  Direkt-Nachricht an {takumi.name.split(" ")[0]}
                </>
              )}
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap gap-2">
            {takumi.verified && (
              <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5">
                <CheckCircle className="size-3 text-accent" />
                <span className="text-xs text-accent font-medium">Verifiziert</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
              <Shield className="size-3 text-primary" />
              <span className="text-xs text-primary font-medium">Geld-zuruck-Garantie</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1.5">
              <MessageSquare className="size-3 text-amber" />
              <span className="text-xs font-medium" style={{ color: "var(--amber)" }}>5 Min gratis</span>
            </div>
          </div>

          {/* Reviews */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Bewertungen ({takumi.reviewCount})
              </h2>
              <div className="flex items-center gap-1">
                <ReviewStars rating={takumi.rating} />
                <span className="text-xs text-muted-foreground">{takumi.rating}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
              <p className="font-jp text-2xl text-muted-foreground/30 mb-1">評</p>
              <p className="text-xs text-muted-foreground">
                Bewertungen werden nach abgeschlossenen Sessions hier angezeigt.
              </p>
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Sticky Book CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-foreground">{takumi.pricePerSession}&euro;</span>
            <span className="text-[10px] text-muted-foreground">pro 30 Min &middot; 5 Min gratis</span>
          </div>
          <Button
            asChild
            className="h-12 rounded-xl bg-accent px-8 text-base font-bold text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20"
          >
            <Link href={`/booking/${takumi.id}`}>Jetzt buchen</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

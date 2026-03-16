"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { Capacitor } from "@capacitor/core"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LiveBadge } from "@/components/live-badge"
import { ReviewStars } from "@/components/review-stars"
import { PageContainer } from "@/components/page-container"
import { useTakumis } from "@/hooks/use-takumis"
import { useI18n } from "@/lib/i18n"
import { notFound } from "next/navigation"
import {
  ArrowLeft, Clock, Video, MessageSquare, Shield, Star, Send, Mail, MessageCircle, Calendar, Loader2, Share2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { SocialLinks, Takumi } from "@/lib/types"
import { InstantCallTrigger } from "@/components/instant-call-trigger"
import { shareNative } from "@/lib/native-utils"
import { getCachedTakumi, setCachedTakumi } from "@/lib/offline-cache"
import { MessageComposeModal } from "@/components/message-compose-modal"
import { TakumiPortfolioGallery, type TakumiPortfolioProject } from "@/components/takumi-portfolio-gallery"
import { UserChatBox } from "@/components/user-chat-box"
import { VerifiedBadge } from "@/components/verified-badge"
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer"

// ─── Social media icon + link helpers ──────────────────────────────────────

const SOCIAL_CONFIG: {
  key: keyof SocialLinks
  label: string
  base: string
  color: string
  icon: React.ReactNode
}[] = [
  {
    key: "instagram", label: "Instagram", base: "https://instagram.com/", color: "#E1306C",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  },
  {
    key: "tiktok", label: "TikTok", base: "https://tiktok.com/@", color: "#000000",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/></svg>,
  },
  {
    key: "youtube", label: "YouTube", base: "https://youtube.com/", color: "#FF0000",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>,
  },
  {
    key: "facebook", label: "Facebook", base: "https://facebook.com/", color: "#1877F2",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  },
  {
    key: "linkedin", label: "LinkedIn", base: "https://linkedin.com/in/", color: "#0A66C2",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  },
  {
    key: "x", label: "X", base: "https://x.com/", color: "#000000",
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
  {
    key: "website", label: "Website", base: "", color: "#6B7280",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  },
]

function toUrl(value: string, base: string): string {
  if (!value) return ""
  const v = value.trim().replace(/^@/, "")
  if (v.startsWith("http://") || v.startsWith("https://")) return v
  return base + v
}

function SocialBar({ links }: { links: SocialLinks }) {
  const active = SOCIAL_CONFIG.filter(({ key }) => !!links[key])
  if (active.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {active.map(({ key, label, base, color, icon }) => {
        const url = toUrl(links[key]!, base)
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:scale-105 hover:shadow-md"
            style={{ color }}
          >
            {icon}
          </a>
        )
      })}
    </div>
  )
}

export default function TakumiProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useI18n()
  const { takumis, isLoading } = useTakumis()
  const [cachedTakumi, setCachedTakumiState] = useState<Takumi | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatPartner, setChatPartner] = useState<{
    userId: string
    partnerName: string
    partnerAvatar: string
    partnerImageUrl?: string | null
    expertId: string
    subcategory: string
  } | null>(null)
  const [portfolioProjects, setPortfolioProjects] = useState<TakumiPortfolioProject[]>([])

  const takumiFromList = takumis.find((tk) => tk.id === id)
  const takumi = takumiFromList ?? cachedTakumi

  useEffect(() => {
    if (!id) return
    getCachedTakumi(id).then((c) => c && setCachedTakumiState(c))
  }, [id])
  useEffect(() => {
    if (takumiFromList) {
      setCachedTakumi(id, takumiFromList)
    }
  }, [id, takumiFromList])

  useEffect(() => {
    if (!id) return
    fetch(`/api/takumi/portfolio?expertId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.projects)) setPortfolioProjects(data.projects)
      })
      .catch(() => {})
  }, [id])
  if (!isLoading && !takumi) notFound()
  if (!takumi) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    )
  }

  const firstName = takumi.name.split(" ")[0] ?? ""

  async function handleStartChat() {
    if (!takumi) return
    if (!takumi.id || chatLoading) return
    setChatLoading(true)
    try {
      const res = await fetch(`/api/messages/recipient-id?expertId=${encodeURIComponent(takumi.id)}`)
      const data = await res.json()
      if (res.ok && data.userId) {
        setChatPartner({
          userId: data.userId,
          partnerName: data.partnerName ?? takumi.name,
          partnerAvatar: data.partnerAvatar ?? takumi.avatar,
          partnerImageUrl: data.partnerImageUrl,
          expertId: takumi.id,
          subcategory: data.subcategory ?? takumi.subcategory ?? "",
        })
        setChatOpen(true)
      } else {
        toast.error(data.error || "Empfänger konnte nicht geladen werden.")
      }
    } catch {
      toast.error("Fehler beim Öffnen des Chats.")
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Cover Area */}
      <div className="relative h-36 bg-gradient-to-br from-primary via-primary to-primary/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(34,197,94,0.2)_0%,_transparent_60%)]" />
        <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between">
          <Link
            href="/home"
            className="flex size-8 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm"
          >
            <ArrowLeft className="size-5 text-white" />
          </Link>
          <button
            type="button"
            onClick={async () => {
              const url = `https://diaiway.com/takumi/${takumi.id}`
              const ok = await shareNative({ title: takumi.name, text: takumi.bio?.slice(0, 120), url })
              if (!ok) toast.info("Teilen ist nur in der App verfügbar.")
            }}
            className="flex size-8 items-center justify-center rounded-full bg-black/20 backdrop-blur-sm"
            aria-label="Profil teilen"
          >
            <Share2 className="size-4 text-white" />
          </button>
        </div>
      </div>

      <PageContainer className="-mt-12 relative z-10 pb-[max(11rem,calc(7rem+env(safe-area-inset-bottom,0px)))]">
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
                {takumi.verified && <VerifiedBadge size="md" className="text-accent" />}
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
              { label: t("takumiPage.sessions"), value: takumi.sessionCount.toString(), icon: Video },
              { label: t("takumiPage.rating"), value: takumi.rating.toString(), icon: Star },
              { label: t("takumiPage.responseTime"), value: takumi.responseTime, icon: Clock },
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
            <h2 className="text-sm font-semibold text-foreground">{t("takumiPage.aboutMe")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{takumi.bio}</p>
          </div>

          {/* Social Media Links */}
          {takumi.socialLinks && Object.values(takumi.socialLinks).some(Boolean) && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t("takumiPage.socialMedia")}</h2>
              <SocialBar links={takumi.socialLinks} />
            </div>
          )}

          {/* Portfolio — Qualitätsnachweis für Shugyo */}
          <TakumiPortfolioGallery
            projects={portfolioProjects}
            readOnly={false}
            title={t("takumiPage.masterpieces")}
            emptyMessage={t("takumiPage.portfolioEmpty")}
          />

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            {takumi.isLive ? (
              <Button
                onClick={handleStartChat}
                disabled={chatLoading}
                className="h-12 w-full gap-2.5 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
              >
                {chatLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                {chatLoading ? t("takumiPage.preparingChat") : t("takumiPage.chatNow").replace("{name}", firstName)}
                <span className="ml-1.5 flex size-2 rounded-full bg-green-400" aria-hidden />
              </Button>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  {takumi.name} ist gerade offline. Du kannst ihm aber eine{" "}
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    Waymail
                  </button>{" "}
                  senden.
                </p>
              </div>
            )}
            {chatOpen && chatPartner && (
              <Drawer open={chatOpen} onOpenChange={setChatOpen} direction="bottom">
                <DrawerContent className="max-h-[90dvh] flex flex-col p-0 gap-0 rounded-t-2xl">
                  <div className="flex flex-1 min-h-0 overflow-hidden">
                    <UserChatBox
                      partnerId={chatPartner.userId}
                      partnerName={chatPartner.partnerName}
                      partnerAvatar={chatPartner.partnerAvatar}
                      partnerImageUrl={chatPartner.partnerImageUrl}
                      partnerIsVerified={takumi.verified}
                      expertId={chatPartner.expertId}
                      subcategory={chatPartner.subcategory}
                      onClose={() => setChatOpen(false)}
                      inline
                      inDrawer
                    />
                  </div>
                </DrawerContent>
              </Drawer>
            )}
            <Button
              onClick={() => setComposeOpen(true)}
              variant="outline"
              className="h-12 w-full gap-2.5 rounded-xl border-primary/30 text-base font-semibold text-primary hover:bg-primary/5"
            >
              <Mail className="size-4" />
              {t("takumiPage.sendMail")}
            </Button>
          </div>

          <MessageComposeModal
            open={composeOpen}
            onOpenChange={setComposeOpen}
            recipientName={takumi.name}
            recipientExpertId={takumi.id}
            onSent={() => toast.success(t("takumiPage.messageSent"))}
          />

          {/* Trust Badges */}
          <div className="flex flex-wrap gap-2">
            {takumi.verified && (
              <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5">
                <VerifiedBadge size="sm" className="text-accent" />
                <span className="text-xs text-accent font-medium">{t("takumiPage.verified")}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
              <Shield className="size-3 text-primary" />
              <span className="text-xs text-primary font-medium">{t("takumiPage.moneyBackGuarantee")}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1.5">
              <MessageSquare className="size-3 text-amber" />
              <span className="text-xs font-medium" style={{ color: "var(--amber)" }}>
                {t("takumiPage.freeMinutes")}
              </span>
            </div>
          </div>

          {/* Reviews */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {t("takumiPage.reviews").replace("{count}", String(takumi.reviewCount))}
              </h2>
              <div className="flex items-center gap-1">
                <ReviewStars rating={takumi.rating} />
                <span className="text-xs text-muted-foreground">{takumi.rating}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
              <p className="font-jp text-2xl text-muted-foreground/30 mb-1">評</p>
              <p className="text-xs text-muted-foreground">
                {t("takumiPage.reviewsEmpty")}
              </p>
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Sticky Bottom Bar: Preis + Termin buchen + Instant Connect (wenn verfügbar) — oberhalb BottomNav */}
      <div className="fixed left-0 right-0 z-40 above-bottom-nav border-t border-border bg-card/95 backdrop-blur-md px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-lg font-bold text-foreground">
              ab {(takumi.priceVoice15Min ?? (takumi.pricePerSession ? takumi.pricePerSession / 2 : 0)).toFixed(0)} €
            </span>
            <span className="text-[10px] text-muted-foreground">{t("takumiPage.priceInfo")}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {takumi.liveStatus === "available" && (
              <InstantCallTrigger
                takumi={takumi}
                variant="profile"
                className="order-2 sm:order-1 h-12 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 text-sm font-bold text-white shadow-md sm:w-auto"
              />
            )}
            <Button
              className={cn(
                "order-1 sm:order-2 h-12 rounded-xl text-sm font-bold w-full sm:w-auto",
                takumi.liveStatus === "available"
                  ? "bg-accent text-accent-foreground hover:bg-accent/90 px-6"
                  : "bg-accent px-6 text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20"
              )}
              onClick={async () => {
                const bookingUrl = `https://www.diaiway.com/booking/${takumi.id}?source=app`
                if (Capacitor.isNativePlatform()) {
                  const { Browser } = await import("@capacitor/browser")
                  await Browser.open({ url: bookingUrl, presentationStyle: "popover" })
                } else {
                  window.location.href = `/booking/${takumi.id}`
                }
              }}
            >
              <Calendar className="size-4" />
              {t("takumiPage.bookAppointment")}
            </Button>
          </div>
        </div>
        {takumi.liveStatus === "in_call" && (
          <p className="mt-1 text-[11px] text-muted-foreground text-center">
            {t("booking.takumiInCall")}
          </p>
        )}
      </div>
    </div>
  )
}

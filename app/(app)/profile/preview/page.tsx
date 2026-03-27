"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LiveBadge } from "@/components/live-badge"
import { ReviewStars } from "@/components/review-stars"
import { ReviewCard } from "@/components/review-card"
import { PageContainer } from "@/components/page-container"
import { VerifiedBadge } from "@/components/verified-badge"
import { TakumiPortfolioGallery, type TakumiPortfolioProject } from "@/components/takumi-portfolio-gallery"
import { useI18n } from "@/lib/i18n"
import { useApp } from "@/lib/app-context"
import {
  Clock, Video, MessageSquare, Shield, Star, Loader2, User, Eye, FolderOpen, ImageIcon,
} from "lucide-react"
import type { SocialLinks } from "@/lib/types"

// ─── Social helpers (identisch zu Profilseite) ─────────────────────────────

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

// ─── Types ─────────────────────────────────────────────────────────────────

type TakumiData = {
  id: string
  name: string
  avatar: string
  categoryName: string
  subcategory: string
  bio: string
  workingBio?: string
  profileReviewStatus?: string
  profileRejectionReason?: string | null
  previewShowsPublicVsPendingHint?: boolean
  priceVideo15Min: number
  priceVoice15Min: number
  pricePerSession: number | null
  responseTime: string
  imageUrl: string
  socialLinks: Record<string, string>
  portfolio: TakumiPortfolioProject[]
  rating: number
  reviewCount: number
  sessionCount: number
  isPro: boolean
  verified: boolean
  liveStatus: string
}

type ExpertReview = {
  rating: number
  text: string
  createdAt: string
  reviewerName: string
  reviewerImage: string
  reviewerAvatar: string
}

type ShugyoData = {
  skillLevel?: string | null
  projects?: { id: string; title: string; description: string; imageUrl: string }[]
  avgRating?: number
  reviewCount?: number
  expertReviews?: ExpertReview[]
}

type UserData = {
  appRole: string
  name: string
  image: string
  createdAt: string
  shugyo?: ShugyoData
  takumi: TakumiData | null
}

type Review = { id: string; rating: number; text: string; createdAt: string; reviewerName: string; reviewerImage?: string }

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ProfilePreviewPage() {
  const { data: session, status } = useSession()
  const { t } = useI18n()
  const { role } = useApp()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    if (!session?.user?.id) {
      if (status !== "loading") setLoading(false)
      return
    }
    fetch("/api/user/profile-preview")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setUser(data)
      })
      .catch(() => setError("Fehler beim Laden"))
      .finally(() => setLoading(false))
  }, [session, status])

  useEffect(() => {
    if (!user?.takumi?.id) return
    fetch(`/api/reviews?expertId=${encodeURIComponent(user.takumi.id)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.reviews)) setReviews(data.reviews) })
      .catch(() => {})
  }, [user?.takumi?.id])

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-sm text-muted-foreground">{t("profile.previewLoginRequired")}</p>
          <Button asChild variant="outline"><Link href="/login">{t("common.login")}</Link></Button>
        </div>
      </PageContainer>
    )
  }

  if (error || !user) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <User className="size-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error || "Profil konnte nicht geladen werden."}</p>
          <Button asChild variant="outline"><Link href="/profile">{t("profile.backToProfile")}</Link></Button>
        </div>
      </PageContainer>
    )
  }

  const appRole = role ?? user.appRole ?? "shugyo"

  // Shugyo-Vorschau: entspricht /user/[id]
  if (appRole !== "takumi" || !user.takumi) {
    const shugyo = user.shugyo
    const displayName = user.name ?? ""
    const initials = displayName
      ? displayName.replace(/[^a-zA-Z0-9]/g, " ").split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
      : "?"
    const memberSince = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
      : ""

    return (
      <div className="min-h-screen bg-background">
      {/* Preview-Banner */}
      <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-primary-foreground/80" />
          <span className="text-xs font-medium text-primary-foreground">{t("profile.previewTitle")}</span>
        </div>
        <Link
          href="/profile"
          className="rounded-lg bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/25"
        >
          {t("profile.backToProfile")}
        </Link>
      </div>
        <PageContainer>
          <div className="flex flex-col gap-6 pb-12">
            <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-6 mt-4">
              <Avatar className="size-20 border-4 border-primary/10">
                {user.image && <AvatarImage src={user.image} alt={displayName} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
              {memberSince && (
                <p className="text-sm text-muted-foreground">
                  {t("profile.memberSince").replace("{date}", memberSince)}
                </p>
              )}
            </div>

            {(shugyo?.skillLevel || (shugyo?.projects && shugyo.projects.length > 0)) && (
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FolderOpen className="size-4 text-primary" />
                  {t("shugyo.dashboardTitle")}
                </h3>
                {shugyo?.skillLevel && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      {t("shugyo.skillLevel")}
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        shugyo.skillLevel === "NEULING"
                          ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40"
                          : shugyo.skillLevel === "FORTGESCHRITTEN"
                            ? "bg-blue-500/20 text-blue-700 border-blue-500/40"
                            : "bg-violet-500/20 text-violet-700 border-violet-500/40"
                      }
                    >
                      {shugyo.skillLevel === "NEULING"
                        ? t("shugyo.skillNeuling")
                        : shugyo.skillLevel === "FORTGESCHRITTEN"
                          ? t("shugyo.skillFortgeschritten")
                          : t("shugyo.skillProfi")}
                    </Badge>
                  </div>
                )}
                {shugyo?.projects && shugyo.projects.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                      {t("shugyo.projectImages")}
                    </p>
                    <div className="flex flex-col gap-2">
                      {shugyo.projects.map((p) => (
                        <div key={p.id} className="rounded-lg border border-border/40 overflow-hidden bg-muted/30">
                          {p.imageUrl ? (
                            <div className="relative aspect-video w-full">
                              <Image src={p.imageUrl} alt={p.title} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="flex aspect-video items-center justify-center bg-muted/50">
                              <ImageIcon className="size-8 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="p-2">
                            <p className="text-xs font-medium text-foreground line-clamp-1">{p.title}</p>
                            {p.description && (
                              <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(!shugyo?.skillLevel && (!shugyo?.projects || shugyo.projects.length === 0)) && (
              <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-6 text-center text-sm text-muted-foreground">
                {t("shugyo.previewEmpty")}
              </p>
            )}

            {/* Bewertungen durch Takumis */}
            {(shugyo?.reviewCount ?? 0) > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("takumiPage.reviews").replace("{count}", String(shugyo?.reviewCount ?? 0))}
                  </h2>
                  <div className="flex items-center gap-1">
                    <ReviewStars rating={shugyo?.avgRating ?? 0} />
                    <span className="text-xs text-muted-foreground">{shugyo?.avgRating}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {shugyo?.expertReviews?.map((review, i) => (
                    <ReviewCard
                      key={i}
                      rating={review.rating}
                      text={review.text}
                      createdAt={review.createdAt}
                      reviewerName={review.reviewerName}
                      reviewerImage={review.reviewerImage}
                      reviewerAvatar={review.reviewerAvatar}
                      reviewerRole="takumi"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </PageContainer>
      </div>
    )
  }

  const tk = user.takumi

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Preview-Banner */}
      <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-primary-foreground/80" />
          <span className="text-xs font-medium text-primary-foreground">{t("profile.previewTitle")}</span>
        </div>
        <Link
          href="/profile"
          className="rounded-lg bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/25"
        >
          {t("profile.backToProfile")}
        </Link>
      </div>

      {tk.profileReviewStatus === "pending_review" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {t("profile.previewModerationPending")}
        </div>
      )}
      {tk.profileReviewStatus === "rejected" && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-foreground">
          <p className="font-medium text-destructive">{t("profile.previewModerationRejected")}</p>
          {tk.profileRejectionReason && (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{tk.profileRejectionReason}</p>
          )}
          <p className="mt-2 text-muted-foreground">
            <a href="mailto:admin@diaiway.com" className="font-medium text-primary underline">
              admin@diaiway.com
            </a>
          </p>
        </div>
      )}
      {tk.previewShowsPublicVsPendingHint && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          {t("profile.previewPublicBioPendingHint")}
        </div>
      )}

      {/* Cover */}
      <div className="relative h-36 bg-gradient-to-br from-primary via-primary to-primary/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(34,197,94,0.2)_0%,_transparent_60%)]" />
      </div>

      <PageContainer className="-mt-12 relative z-10 pb-[max(11rem,calc(7rem+env(safe-area-inset-bottom,0px)))]">
        <div className="flex flex-col gap-6">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar className="size-24 border-4 border-card shadow-lg">
              {tk.imageUrl && <AvatarImage src={tk.imageUrl} alt={tk.name} className="object-cover" />}
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                {tk.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{tk.name}</h1>
                {tk.verified && <VerifiedBadge size="md" className="text-accent" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-jp text-sm text-primary/60">匠</span>
                {tk.isPro && (
                  <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none">PRO</Badge>
                )}
                {tk.liveStatus === "available" && <LiveBadge size="md" />}
              </div>
              <p className="text-sm text-muted-foreground">
                {tk.categoryName} &middot; {tk.subcategory}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("takumiPage.sessions"), value: tk.sessionCount.toString(), icon: Video },
              { label: t("takumiPage.rating"), value: tk.rating.toString(), icon: Star },
              { label: t("takumiPage.responseTime"), value: tk.responseTime, icon: Clock },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card p-3">
                <stat.icon className="size-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{stat.value}</span>
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Bio */}
          {tk.bio && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t("takumiPage.aboutMe")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{tk.bio}</p>
            </div>
          )}

          {/* Social Media Links */}
          {tk.socialLinks && Object.values(tk.socialLinks).some(Boolean) && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t("takumiPage.socialMedia")}</h2>
              <SocialBar links={tk.socialLinks} />
            </div>
          )}

          {/* Portfolio */}
          <TakumiPortfolioGallery
            projects={tk.portfolio}
            readOnly
            title={t("takumiPage.masterpieces")}
            emptyMessage={t("takumiPage.portfolioEmpty")}
          />

          {/* Action-Bereich — deaktiviert mit Hinweis */}
          <div className="flex flex-col gap-2.5 opacity-50 pointer-events-none select-none">
            <div className="h-12 w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground">
              <span className="text-sm">{t("takumiPage.chatNow").replace("{name}", tk.name)}</span>
            </div>
            <div className="h-12 w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 text-base font-semibold text-primary">
              <span className="text-sm">{t("takumiPage.sendMail")}</span>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap gap-2">
            {tk.verified && (
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
                {t("takumiPage.reviews").replace("{count}", String(tk.reviewCount))}
              </h2>
              <div className="flex items-center gap-1">
                <ReviewStars rating={tk.rating} />
                <span className="text-xs text-muted-foreground">{tk.rating}</span>
              </div>
            </div>
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
                <p className="font-jp text-2xl text-muted-foreground/30 mb-1">評</p>
                <p className="text-xs text-muted-foreground">{t("takumiPage.reviewsEmpty")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    rating={review.rating}
                    text={review.text}
                    createdAt={review.createdAt}
                    reviewerName={review.reviewerName}
                    reviewerImage={review.reviewerImage}
                    reviewerRole="shugyo"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContainer>

      {/* Sticky Bottom Bar — deaktiviert */}
      <div className="fixed left-0 right-0 z-40 above-bottom-nav border-t border-border bg-card/95 backdrop-blur-md px-4 py-4 opacity-50 pointer-events-none select-none">
        <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-lg font-bold text-foreground">
              ab {(tk.priceVoice15Min ?? (tk.pricePerSession ? tk.pricePerSession / 2 : 0)).toFixed(0)} €
            </span>
            <span className="text-[10px] text-muted-foreground">{t("takumiPage.priceInfo")}</span>
          </div>
          <div className="h-12 rounded-xl bg-accent px-6 flex items-center text-sm font-bold text-accent-foreground">
            {t("takumiPage.bookAppointment")}
          </div>
        </div>
      </div>
    </div>
  )
}

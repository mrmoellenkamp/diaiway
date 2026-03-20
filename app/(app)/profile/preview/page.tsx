"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/page-container"
import { ArrowLeft, FolderOpen, ImageIcon, Loader2, User, Euro, Clock } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useApp } from "@/lib/app-context"
import { TakumiPortfolioGallery, type TakumiPortfolioProject } from "@/components/takumi-portfolio-gallery"
import type { SocialLinks } from "@/lib/types"

// ─── Social links für Takumi-Vorschau ──────────────────────────────────────

const SOCIAL_CONFIG: { key: keyof SocialLinks; label: string; base: string; color: string }[] = [
  { key: "instagram", label: "Instagram", base: "https://instagram.com/", color: "#E1306C" },
  { key: "tiktok", label: "TikTok", base: "https://tiktok.com/@", color: "#000000" },
  { key: "youtube", label: "YouTube", base: "https://youtube.com/", color: "#FF0000" },
  { key: "facebook", label: "Facebook", base: "https://facebook.com/", color: "#1877F2" },
  { key: "linkedin", label: "LinkedIn", base: "https://linkedin.com/in/", color: "#0A66C2" },
  { key: "x", label: "X", base: "https://x.com/", color: "#000000" },
  { key: "website", label: "Website", base: "", color: "#6B7280" },
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
      {active.map(({ key, label, base, color }) => {
        const url = toUrl(links[key]!, base)
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            className="flex size-9 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted/50"
            style={{ color }}
          >
            {key === "instagram" && <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162z"/></svg>}
            {key === "tiktok" && <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/></svg>}
            {key === "youtube" && <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>}
            {key === "facebook" && <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
            {key === "linkedin" && <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>}
            {key === "x" && <svg viewBox="0 0 24 24" fill="currentColor" className="size-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
            {key === "website" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>}
          </a>
        )
      })}
    </div>
  )
}

// ─── API Response Types ────────────────────────────────────────────────────

type ShugyoData = { skillLevel: string | null; projects: { id: string; title: string; description: string; imageUrl: string }[] }
type TakumiData = {
  id: string
  name: string
  avatar: string
  categoryName: string
  subcategory: string
  bio: string
  priceVideo15Min: number
  priceVoice15Min: number
  pricePerSession: number | null
  responseTime: string
  imageUrl: string
  socialLinks: Record<string, string>
  portfolio: TakumiPortfolioProject[]
} | null

type UserData = {
  appRole: string
  name: string
  image: string
  createdAt: string
  shugyo: ShugyoData
  takumi: TakumiData
}

export default function ProfilePreviewPage() {
  const { data: session, status } = useSession()
  const { t } = useI18n()
  const { role } = useApp()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  const appRole = role ?? user?.appRole ?? "shugyo"
  const displayName = user?.name ?? ""
  const initials = displayName
    ? displayName.replace(/[^a-zA-Z0-9]/g, " ").split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    : ""

  const formatPrice = (eur: number) => `€${eur.toFixed(2).replace(".", ",")}`

  if (status === "loading" || loading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageContainer>
    )
  }

  if (!session?.user) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <p className="text-sm text-muted-foreground">{t("profile.previewLoginRequired")}</p>
          <Button asChild variant="outline">
            <Link href="/login">{t("common.login")}</Link>
          </Button>
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
          <Button asChild variant="outline">
            <Link href="/profile">{t("profile.backToProfile")}</Link>
          </Button>
        </div>
      </PageContainer>
    )
  }

  const showShugyo = appRole === "shugyo" && (user.shugyo.skillLevel || (user.shugyo.projects?.length ?? 0) > 0)
  const showTakumi = appRole === "takumi" && user.takumi

  return (
    <PageContainer>
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label={t("profile.backToProfile")}>
            <Link href="/profile">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-bold text-foreground">{t("profile.previewTitle")}</h1>
        </div>

        <p className="text-xs text-muted-foreground">{t("profile.previewDesc")}</p>

        {/* Gemeinsamer Header: Avatar, Name, Mitglied seit */}
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-6">
          <Avatar className="size-20 border-4 border-primary/10">
            {(appRole === "takumi" && user.takumi?.imageUrl) || user.image ? (
              <Image
                src={(appRole === "takumi" && user.takumi?.imageUrl) || user.image || ""}
                alt={user.name}
                width={80}
                height={80}
                unoptimized
                className="size-full rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {appRole === "takumi" && user.takumi ? user.takumi.avatar : initials}
              </AvatarFallback>
            )}
          </Avatar>
          <h2 className="text-xl font-bold text-foreground">
            {appRole === "takumi" && user.takumi ? user.takumi.name : user.name}
          </h2>
          {memberSince && (
            <p className="text-sm text-muted-foreground">
              {t("profile.memberSince").replace("{date}", memberSince)}
            </p>
          )}
          {appRole === "takumi" && user.takumi && (
            <p className="text-sm text-muted-foreground">
              {user.takumi.categoryName} &middot; {user.takumi.subcategory}
            </p>
          )}
        </div>

        {/* Shugyo: Kenntnisstufe + Projekte — nur bei aktueller Rolle Shugyo */}
        {showShugyo && (
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FolderOpen className="size-4 text-primary" />
              {t("shugyo.dashboardTitle")}
            </h3>
            {user.shugyo.skillLevel && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                  {t("shugyo.skillLevel")}
                </p>
                <Badge
                  variant="outline"
                  className={
                    user.shugyo.skillLevel === "NEULING"
                      ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40"
                      : user.shugyo.skillLevel === "FORTGESCHRITTEN"
                        ? "bg-blue-500/20 text-blue-700 border-blue-500/40"
                        : "bg-violet-500/20 text-violet-700 border-violet-500/40"
                  }
                >
                  {user.shugyo.skillLevel === "NEULING"
                    ? t("shugyo.skillNeuling")
                    : user.shugyo.skillLevel === "FORTGESCHRITTEN"
                      ? t("shugyo.skillFortgeschritten")
                      : t("shugyo.skillProfi")}
                </Badge>
              </div>
            )}
            {user.shugyo.projects && user.shugyo.projects.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                  {t("shugyo.projectImages")}
                </p>
                <div className="flex flex-col gap-2">
                  {user.shugyo.projects.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border/40 overflow-hidden bg-muted/30"
                    >
                      {p.imageUrl ? (
                        <div className="relative aspect-video w-full">
                          <Image
                            src={p.imageUrl}
                            alt={p.title}
                            fill
                            className="object-cover"
                            sizes="320px"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-muted/50">
                          <ImageIcon className="size-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-xs font-medium text-foreground line-clamp-1">{p.title}</p>
                        {p.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Takumi: Bio, Preise, Portfolio, Social — nur bei aktueller Rolle Takumi */}
        {showTakumi && user.takumi && (
          <>
            {(user.takumi.priceVideo15Min > 0 || user.takumi.priceVoice15Min > 0) && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Euro className="size-4 text-primary" />
                  {t("takumiPage.prices")}
                </h3>
                <div className="flex flex-wrap gap-3 text-sm">
                  {user.takumi.priceVideo15Min > 0 && (
                    <span className="text-muted-foreground">
                      Video 15 Min: {formatPrice(user.takumi.priceVideo15Min)}
                    </span>
                  )}
                  {user.takumi.priceVoice15Min > 0 && (
                    <span className="text-muted-foreground">
                      Voice 15 Min: {formatPrice(user.takumi.priceVoice15Min)}
                    </span>
                  )}
                </div>
              </div>
            )}
            {user.takumi.responseTime && (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-4">
                <Clock className="size-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {t("takumiPage.responseTime")}: {user.takumi.responseTime}
                </span>
              </div>
            )}
            {user.takumi.bio && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground">{t("takumiPage.aboutMe")}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{user.takumi.bio}</p>
              </div>
            )}
            {user.takumi.socialLinks && Object.values(user.takumi.socialLinks).some(Boolean) && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground">{t("takumiPage.socialMedia")}</h2>
                <SocialBar links={user.takumi.socialLinks} />
              </div>
            )}
            <TakumiPortfolioGallery
              projects={user.takumi.portfolio}
              readOnly
              title={t("takumiPage.masterpieces")}
              emptyMessage={t("takumiPage.portfolioEmpty")}
            />
          </>
        )}

        {!showShugyo && !showTakumi && (
          <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-6 text-center text-sm text-muted-foreground">
            {appRole === "shugyo"
              ? t("shugyo.previewEmpty")
              : t("takumi.previewEmpty")}
          </p>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link href="/profile">{t("profile.backToProfile")}</Link>
        </Button>
      </div>
    </PageContainer>
  )
}

"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/page-container"
import { ReviewCard } from "@/components/review-card"
import { ReviewStars } from "@/components/review-stars"
import { ArrowLeft, FolderOpen, ImageIcon, Loader2, User } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type ExpertReview = {
  rating: number
  text: string
  createdAt: string
  reviewerName: string
  reviewerImage: string
  reviewerAvatar: string
}

type UserData = {
  name: string
  image: string
  createdAt: string
  skillLevel?: string | null
  projects?: { id: string; title: string; description: string; imageUrl: string }[]
  avgRating?: number
  reviewCount?: number
  expertReviews?: ExpertReview[]
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setUser(data)
      })
      .catch(() => setError("Fehler beim Laden"))
      .finally(() => setLoading(false))
  }, [id])

  const initials = user?.name
    ? user.name.trim().includes(" ")
      ? user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : user.name.slice(0, 2).toUpperCase()
    : "?"

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    : ""

  if (loading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageContainer>
    )
  }

  if (error || !user) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <User className="size-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error || "Nutzer nicht gefunden."}</p>
          <Button variant="outline" onClick={() => router.back()}>
            {t("common.back")}
          </Button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label={t("common.back")}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">{t("common.profile")}</h1>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-6">
          <Avatar className="size-20 border-4 border-[rgba(6,78,59,0.1)]">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name}
                width={80}
                height={80}
                unoptimized
                className="size-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-[rgba(6,78,59,0.1)] text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          {memberSince && (
            <p className="text-sm text-muted-foreground">
              {t("profile.memberSince").replace("{date}", memberSince)}
            </p>
          )}
        </div>

        {/* Shugyo Kenntnisse + Projekte (nur sichtbar für Takumi) */}
        {(user.skillLevel || (user.projects && user.projects.length > 0)) && (
          <div className="flex flex-col gap-3 rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FolderOpen className="size-4 text-primary" />
              {t("shugyo.dashboardTitle")}
            </h3>
            {user.skillLevel && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                  {t("shugyo.skillLevel")}
                </p>
                <Badge
                  variant="outline"
                  className={
                    user.skillLevel === "NEULING"
                      ? "bg-[rgba(16,185,129,0.2)] text-emerald-700 border-[rgba(16,185,129,0.4)]"
                      : user.skillLevel === "FORTGESCHRITTEN"
                        ? "bg-[rgba(59,130,246,0.2)] text-blue-700 border-[rgba(59,130,246,0.4)]"
                        : "bg-[rgba(139,92,246,0.2)] text-violet-700 border-[rgba(139,92,246,0.4)]"
                  }
                >
                  {user.skillLevel === "NEULING"
                    ? t("shugyo.skillNeuling")
                    : user.skillLevel === "FORTGESCHRITTEN"
                      ? t("shugyo.skillFortgeschritten")
                      : t("shugyo.skillProfi")}
                </Badge>
              </div>
            )}
            {user.projects && user.projects.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                  {t("shugyo.projectImages")}
                </p>
                <div className="flex flex-col gap-2">
                  {user.projects.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-[rgba(231,229,227,0.4)] overflow-hidden bg-[rgba(245,245,244,0.3)]"
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
                        <div className="flex aspect-video items-center justify-center bg-[rgba(245,245,244,0.5)]">
                          <ImageIcon className="size-8 text-[rgba(120,113,108,0.4)]" />
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

        {/* Bewertungen durch Takumis */}
        {(user.reviewCount ?? 0) > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {t("takumiPage.reviews").replace("{count}", String(user.reviewCount ?? 0))}
              </h2>
              <div className="flex items-center gap-1">
                <ReviewStars rating={user.avgRating ?? 0} />
                <span className="text-xs text-muted-foreground">{user.avgRating}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {user.expertReviews?.map((review, i) => (
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

        <p className="text-center text-xs text-muted-foreground">
          {t("profile.userProfileHint")}
        </p>

        <Button asChild variant="outline" className="w-full">
          <Link href="/messages">{t("messages.title")}</Link>
        </Button>
      </div>
    </PageContainer>
  )
}

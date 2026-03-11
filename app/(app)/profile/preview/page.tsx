"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/page-container"
import { ArrowLeft, FolderOpen, ImageIcon, Loader2, User } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type UserData = {
  name: string
  image: string
  createdAt: string
  skillLevel?: string | null
  projects?: { id: string; title: string; description: string; imageUrl: string }[]
}

export default function ProfilePreviewPage() {
  const { data: session, status } = useSession()
  const { t } = useI18n()
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

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    : ""

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

        <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-6">
          <Avatar className="size-20 border-4 border-primary/10">
            {user.image ? (
              <img src={user.image} alt={user.name} className="size-full rounded-full object-cover" />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
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

        {(user.skillLevel || (user.projects && user.projects.length > 0)) && (
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
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
                      ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40"
                      : user.skillLevel === "FORTGESCHRITTEN"
                        ? "bg-blue-500/20 text-blue-700 border-blue-500/40"
                        : "bg-violet-500/20 text-violet-700 border-violet-500/40"
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

        <Button asChild variant="outline" className="w-full">
          <Link href="/profile">{t("profile.backToProfile")}</Link>
        </Button>
      </div>
    </PageContainer>
  )
}

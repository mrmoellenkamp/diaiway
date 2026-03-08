"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/page-container"
import { ArrowLeft, Loader2, User } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useI18n()
  const [user, setUser] = useState<{ name: string; image: string; createdAt: string } | null>(null)
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
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
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

        <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-6">
          <Avatar className="size-20 border-4 border-primary/10">
            {user.image ? (
              <img src={user.image} alt={user.name} className="size-full object-cover" />
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

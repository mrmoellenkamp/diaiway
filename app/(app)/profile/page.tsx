"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageUpload } from "@/components/image-upload"
import { Switch } from "@/components/ui/switch"
import { useApp } from "@/lib/app-context"
import { useSWRConfig } from "swr"
import { ProfileFavoritesSection } from "@/components/profile-favorites-section"

import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Edit3,
  Wallet,
  BarChart3,
  Loader2,
  Check,
  X,
  XCircle,
  FolderOpen,
  Images,
  Eye,
  Shield,
  HelpCircle,
} from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { TakumiStatusCard } from "@/components/takumi-status-card"
import { LanguageFlagSticker } from "@/components/language-flag-sticker"
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  href,
  accent = false,
  comingSoonKey,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  accent?: boolean
  comingSoonKey?: string
}) {
  const { t } = useI18n()
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon className={`size-5 ${accent ? "text-accent" : "text-muted-foreground"}`} />
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground/50" />
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block transition-colors hover:bg-muted/50">
        {inner}
      </Link>
    )
  }

  return (
    <button
      className="block w-full text-left transition-colors hover:bg-muted/50"
      onClick={() => toast.info(comingSoonKey ? t(comingSoonKey) : t("profile.comingSoon"))}
    >
      {inner}
    </button>
  )
}

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const { role, setRole, setIsLoggedIn, profileData, profileLoading: appProfileLoading, refreshProfile } = useApp()
  const { t } = useI18n()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const [hideOnlineStatus, setHideOnlineStatus] = useState(false)
  const isTakumi = role === "takumi"

  // Profile data from DB
  const [profileLoading, setProfileLoading] = useState(true)
  const [dbName, setDbName] = useState("")
  const [dbUsername, setDbUsername] = useState<string | null>(null)
  const [dbEmail, setDbEmail] = useState("")
  const [dbImage, setDbImage] = useState("")
  const [dbIsVerified, setDbIsVerified] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [skillLevel, setSkillLevel] = useState<string | null>(null)
  const [projectCount, setProjectCount] = useState(0)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)

  // Edit state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState("")
  const [editImage, setEditImage] = useState("")
  const [isEditingImage, setIsEditingImage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savingSkill, setSavingSkill] = useState(false)

  // Username edit + availability check
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [editUsername, setEditUsername] = useState("")
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  type UCheckState = "idle" | "checking" | "available" | "taken" | "invalid"
  const [usernameCheck, setUsernameCheck] = useState<UCheckState>("idle")
  const [usernameReason, setUsernameReason] = useState("")
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isEditingUsername) return
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current)
    const trimmed = editUsername.trim()
    if (!trimmed || trimmed === dbUsername) {
      setUsernameCheck("idle")
      setUsernameReason("")
      return
    }
    setUsernameCheck("checking")
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/check-username?username=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        if (data.available) {
          setUsernameCheck("available")
          setUsernameReason("")
        } else {
          const isFormat = data.reason && !data.reason.includes("vergeben") && !data.reason.includes("taken")
          setUsernameCheck(isFormat ? "invalid" : "taken")
          setUsernameReason(data.reason ?? "")
        }
      } catch {
        setUsernameCheck("idle")
      }
    }, 500)
    return () => { if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current) }
  }, [editUsername, isEditingUsername, dbUsername])

  // Sync profile data from AppProvider (kein doppelter Fetch)
  useEffect(() => {
    if (profileData) {
      setDbName(profileData.name)
      setDbUsername(profileData.username)
      setDbEmail(profileData.email)
      setDbImage(profileData.image)
      setDbIsVerified(profileData.isVerified)
      setFavorites(profileData.favorites)
      setLanguages(profileData.languages)
      setSkillLevel(profileData.skillLevel)
      const currentVerified = (session?.user as { isVerified?: boolean })?.isVerified ?? false
      if (profileData.isVerified !== currentVerified) {
        updateSession({ isVerified: profileData.isVerified })
      }
    } else if (!appProfileLoading && session?.user) {
      // Fallback bei fehlgeschlagenem Fetch: Session-Daten nutzen
      const u = session.user as { name?: string; email?: string; image?: string; username?: string }
      setDbName(u.name || "")
      setDbUsername(u.username ?? null)
      setDbEmail(u.email || "")
      setDbImage(u.image || "")
      setFavorites([])
      setLanguages([])
    }
  }, [profileData, appProfileLoading, session?.user, updateSession])

  // Nur Buchungen + Takumi-Profile/Projekte laden (Profil kommt von AppProvider)
  useEffect(() => {
    async function loadBookingsAndExtras() {
      if (!session?.user) return
      if (profileData === null && appProfileLoading) return
      setProfileLoading(true)
      try {
        const fetches: Promise<Response>[] = [
          fetch(`/api/bookings?view=${isTakumi ? "takumi" : "shugyo"}`),
        ]
        if (isTakumi) fetches.push(fetch("/api/user/takumi-profile"))
        else fetches.push(fetch("/api/shugyo/projects"))
        const [bookingsRes, takumiOrProjectsRes] = await Promise.all(fetches)
        if (!isTakumi && takumiOrProjectsRes?.ok) {
          const { projects } = await takumiOrProjectsRes.json()
          setProjectCount(Array.isArray(projects) ? projects.length : 0)
        }
        if (bookingsRes.ok) {
          const bookings = await bookingsRes.json()
          const list = Array.isArray(bookings) ? bookings : bookings.bookings || []
          const completed = list.filter((b: { status: string }) => b.status === "confirmed" || b.status === "completed")
          setCompletedSessions(completed.length)
          setTotalSpent(
            completed.reduce((sum: number, b: { price?: number }) => sum + (b.price || 0), 0)
          )
        }
        if (isTakumi && takumiOrProjectsRes?.ok) {
          const tp = await takumiOrProjectsRes.json()
          if (tp.exists && typeof tp.hideOnlineStatus === "boolean") setHideOnlineStatus(tp.hideOnlineStatus)
        }
      } catch {
        /* fallback */
      } finally {
        setProfileLoading(false)
      }
    }
    if (session?.user && profileData) {
      loadBookingsAndExtras()
    } else if (status !== "loading" && !appProfileLoading) {
      setProfileLoading(false)
    }
  }, [session?.user, status, profileData, appProfileLoading, isTakumi])

  // Prefer username as profile name, then name
  const userName = (dbUsername ?? dbName) || ((session?.user as { username?: string | null })?.username ?? session?.user?.name) || t("profile.userFallback")
  const userEmail = dbEmail || session?.user?.email || ""
  const userImage = dbImage || session?.user?.image || ""
  const userInitials = userName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()



  async function handleSkillLevelChange(level: "NEULING" | "FORTGESCHRITTEN" | "PROFI") {
    setSavingSkill(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillLevel: level }),
      })
      if (res.ok) {
        setSkillLevel(level)
        toast.success(t("shugyo.skillSaved"))
      } else {
        const data = await res.json()
        toast.error(data.error || t("profile.error"))
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setSavingSkill(false)
    }
  }

  async function handleSaveProfile() {
    const updates: Record<string, string | string[] | null> = {}
    if (isEditingName && editName.trim() && editName.trim() !== userName) {
      const trimmed = editName.trim()
      if (trimmed.length < 2) {
        toast.error(t("profile.nameMinLength"))
        return
      }
      if (dbUsername != null) {
        updates.username = trimmed
      } else {
        updates.name = trimmed
      }
    }
    if (isEditingImage && editImage !== userImage) {
      updates.image = editImage
    }
    if (Object.keys(updates).length === 0) {
      toast.info(t("profile.noChanges"))
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        if (typeof updates.username === "string") {
          setDbUsername(updates.username)
          await updateSession({ username: updates.username })
        } else if (typeof updates.name === "string") {
          setDbName(updates.name)
          await updateSession({ name: updates.name })
        }
        if (updates.image !== undefined && typeof updates.image === "string") {
          setDbImage(updates.image)
          await updateSession({ image: updates.image })
        }
        setIsEditingName(false)
        setIsEditingImage(false)
        setHasUnsavedChanges(false)
        refreshProfile()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveUsername() {
    const trimmed = editUsername.trim()
    if (!trimmed) {
      toast.error(t("register.usernameInvalid"))
      return
    }
    if (usernameCheck === "taken" || usernameCheck === "invalid") {
      toast.error(usernameReason || t("register.usernameInvalid"))
      return
    }
    if (usernameCheck === "checking") {
      toast.info(t("register.usernameChecking"))
      return
    }
    setIsSavingUsername(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      })
      const data = await res.json()
      if (res.ok) {
        setDbUsername(trimmed)
        await updateSession({ username: trimmed })
        setIsEditingUsername(false)
        setUsernameCheck("idle")
        toast.success(data.message)
        refreshProfile()
      } else {
        toast.error(data.message || data.error)
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setIsSavingUsername(false)
    }
  }

  async function handleLogout() {
    setIsLoggedIn(false)
    await signOut({ redirect: false })
    toast.success(t("profile.loggedOut"))
    window.location.replace("/")
  }

  const showLoading = (session && !profileData && appProfileLoading) || (profileData && profileLoading)

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Loading state */}
        {showLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
        <>
        {/* User header */}
        <div className="relative flex flex-col items-center gap-3 pt-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="absolute right-0 top-0 gap-1.5 text-xs"
          >
            <Link href="/profile/preview">
              <Eye className="size-3.5" />
              {t("profile.previewTitle")}
            </Link>
          </Button>
            {isEditingImage ? (
              <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                <ImageUpload
                  value={editImage}
                  onChange={(url) => { setEditImage(url); setHasUnsavedChanges(true) }}
                  folder="profiles"
                  variant="avatar"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => { setIsEditingImage(false); setEditImage("") }}
                >
                  <X className="size-3.5" />
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => { setEditImage(userImage); setIsEditingImage(true); setHasUnsavedChanges(true) }}
                  className="group relative"
                >
                  <Avatar className="size-20 border-4 border-primary/10">
                    {userImage ? (
                      <img src={userImage} alt={userName} className="size-full rounded-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                        {userInitials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Edit3 className="size-4 text-white" />
                  </div>
                </button>
              </div>
            )}

            <div className="flex flex-col items-center gap-1 text-center">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setHasUnsavedChanges(true) }}
                    className="h-8 w-40 text-center text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => { setIsEditingName(false); setEditName("") }}
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditName(userName); setIsEditingName(true); setHasUnsavedChanges(true) }}
                  className="flex items-center gap-1.5 group"
                >
                  <h2 className="text-xl font-bold text-foreground">{userName}</h2>
                  {dbIsVerified && <VerifiedBadge size="md" />}
                  <Edit3 className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
              <p className="text-xs text-muted-foreground">{userEmail}</p>
              <div className="mt-1 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/5 text-primary text-[10px]"
                  >
                    {isTakumi ? "Takumi" : "Shugyo"}{" "}
                    <span className="font-jp ml-0.5">{isTakumi ? "匠" : "修行"}</span>
                  </Badge>
                  {(session?.user as { role?: string })?.role === "admin" && (
                    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                      Admin
                    </Badge>
                  )}
                </div>
                {languages.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {languages.map((lang) => (
                      <LanguageFlagSticker key={lang} lang={lang} showLabel="flagOnly" size="sm" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save button (shown when there are unsaved changes) */}
          {hasUnsavedChanges && (
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="w-full gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {t("profile.saveChanges")}
                </>
              )}
            </Button>
          )}

          {/* Stats */}
          <Card className="border-border/60 gap-0 py-0">
            <CardContent className="flex items-center justify-around p-4">
              <StatBox label={t("profile.sessions")} value={String(completedSessions)} />
              <div className="h-8 w-px bg-border" />
              <StatBox label={isTakumi ? t("profile.earned") : t("profile.spent")} value={`${totalSpent}\u20AC`} />
              <div className="h-8 w-px bg-border" />
              <StatBox label={t("profile.favorites")} value={String(favorites.length)} />
            </CardContent>
          </Card>

          {/* Benutzername */}
          <Card className="border-border/60 gap-0 py-0">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{t("register.username")}</span>
                {!isEditingUsername && (
                  <button
                    onClick={() => { setEditUsername(dbUsername ?? ""); setIsEditingUsername(true); setUsernameCheck("idle") }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Edit3 className="size-3" />
                    {t("profile.editUsername")}
                  </button>
                )}
              </div>
              {isEditingUsername ? (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Input
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder={t("register.usernamePlaceholder")}
                      className={`h-10 rounded-xl pr-10 text-sm ${
                        usernameCheck === "taken" || usernameCheck === "invalid"
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : usernameCheck === "available"
                          ? "border-green-500 focus-visible:ring-green-500/30"
                          : ""
                      }`}
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameCheck === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                      {usernameCheck === "available" && <CheckCircle2 className="size-4 text-green-500" />}
                      {(usernameCheck === "taken" || usernameCheck === "invalid") && <XCircle className="size-4 text-destructive" />}
                    </span>
                  </div>
                  {usernameCheck === "available" && (
                    <p className="text-[11px] text-green-600">{t("register.usernameAvailable")}</p>
                  )}
                  {(usernameCheck === "taken" || usernameCheck === "invalid") && usernameReason && (
                    <p className="text-[11px] text-destructive">{usernameReason}</p>
                  )}
                  {usernameCheck === "idle" && (
                    <p className="text-[11px] text-muted-foreground">{t("register.usernameHint")}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveUsername}
                      disabled={isSavingUsername || usernameCheck === "checking" || usernameCheck === "taken" || usernameCheck === "invalid"}
                      className="flex-1 rounded-xl"
                    >
                      {isSavingUsername ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      {t("profile.saveChanges")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setIsEditingUsername(false); setUsernameCheck("idle") }}
                      className="rounded-xl"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {dbUsername ? (
                    <span className="font-mono text-foreground">@{dbUsername}</span>
                  ) : (
                    <span className="italic">{t("register.usernameHint")}</span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Shugyo Lerner-Profil (nur für Shugyo sichtbar) */}
          {!isTakumi && (
            <Card className="border-primary/20 bg-primary/5 gap-0 py-0">
              <CardContent className="flex flex-col gap-3 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FolderOpen className="size-4 text-primary" />
                  {t("shugyo.dashboardTitle")}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("shugyo.skillLevel")}:</span>
                  {(["NEULING", "FORTGESCHRITTEN", "PROFI"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handleSkillLevelChange(level)}
                      disabled={savingSkill}
                      className="focus:outline-none"
                    >
                      <Badge
                        variant="outline"
                        className={`cursor-pointer text-[10px] transition-all ${
                          skillLevel === level
                            ? level === "NEULING"
                              ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/40"
                              : level === "FORTGESCHRITTEN"
                                ? "bg-blue-500/20 text-blue-700 border-blue-500/40"
                                : "bg-violet-500/20 text-violet-700 border-violet-500/40"
                            : "bg-muted/50 text-muted-foreground border-border"
                        } ${savingSkill ? "opacity-70" : ""}`}
                      >
                        {level === "NEULING"
                          ? t("shugyo.skillNeuling")
                          : level === "FORTGESCHRITTEN"
                            ? t("shugyo.skillFortgeschritten")
                            : t("shugyo.skillProfi")}
                      </Badge>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t("shugyo.projectCount", { count: String(projectCount) })}
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/profile/shugyo">{t("shugyo.manageProjects")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Favorites – Takumis werden nur bei Favoriten geladen */}
          <ProfileFavoritesSection favoriteIds={favorites} />

          {/* Role switcher */}
          <Card className="border-border/60 gap-0 py-0">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t("profile.switchRole")}</span>
                <span className="text-xs text-muted-foreground">
                  {isTakumi ? t("profile.currentRoleTakumi") : t("profile.currentRoleShugyo")}
                </span>
              </div>
              <Switch
                checked={isTakumi}
                onCheckedChange={(checked) => {
                  setRole(checked ? "takumi" : "shugyo")
                  toast.success(checked ? t("profile.nowTakumi") : t("profile.nowShugyo"))
                }}
              />
            </CardContent>
          </Card>

          {/* Online-Status verbergen (Takumi only) */}
          {isTakumi && (
            <>
            <Card className="border-border/60 gap-0 py-0">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {hideOnlineStatus ? t("profile.statusHidden") : t("profile.activateToBeInvisible")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("profile.hideOnlineStatusDesc")}
                  </span>
                </div>
                <Switch
                  checked={hideOnlineStatus}
                  onCheckedChange={async (v) => {
                    try {
                      const res = await fetch("/api/user/takumi-profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ hideOnlineStatus: v }),
                      })
                      if (res.ok) {
                        setHideOnlineStatus(v)
                        mutate("/api/takumis")
                        mutate("/api/messages")
                        toast.success(v ? t("profile.nowHidden") : t("profile.nowVisible"))
                      } else {
                        const data = await res.json()
                        toast.error(data.error || t("profile.error"))
                      }
                    } catch {
                      toast.error(t("common.networkError"))
                    }
                  }}
                />
              </CardContent>
            </Card>
            <TakumiStatusCard />
            </>
          )}

          {/* Takumi earnings (Takumi only) */}
          {isTakumi && (
            <Card className="border-border/60 gap-0 py-0">
              <CardContent className="flex flex-col gap-3 p-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Wallet className="size-4 text-accent" />
                  {t("profile.earnings")}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted p-3">
                    <span className="text-base font-bold text-foreground">{`${totalSpent}\u20AC`}</span>
                    <span className="text-[10px] text-muted-foreground">{t("profile.total")}</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted p-3">
                    <span className="text-base font-bold text-foreground">{completedSessions}</span>
                    <span className="text-[10px] text-muted-foreground">{t("profile.sessions")}</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted p-3">
                    <span className="text-base font-bold text-foreground">{favorites.length}</span>
                    <span className="text-[10px] text-muted-foreground">{t("profile.favorites")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Menu items */}
          <Card className="overflow-hidden border-border/60 gap-0 py-0">
            <CardContent className="flex flex-col p-0 divide-y divide-border">
              <MenuItem icon={Edit3} label={t("profile.editProfile")} href="/profile/edit" accent />
              <MenuItem icon={FolderOpen} label={t("shugyo.myProjects")} href="/profile/shugyo" />
              <MenuItem icon={Calendar} label={t("profile.myBookings")} href="/sessions" />
              {isTakumi && (
                <MenuItem icon={CalendarClock} label={t("nav.myAvailability")} href="/profile/availability" />
              )}
              {isTakumi && (
                <MenuItem icon={Images} label={t("nav.myPortfolio")} href="/dashboard/takumi/portfolio" />
              )}
              <MenuItem icon={CreditCard} label={t("profile.finances")} href="/profile/finances" />
              <MenuItem icon={FileText} label={t("profile.invoiceData")} href="/profile/invoice-data" />
              <MenuItem icon={Settings} label={t("profile.account")} href="/profile/settings" />
              <MenuItem icon={Shield} label={t("footer.privacy")} href="/legal/datenschutz" />
              <MenuItem icon={HelpCircle} label={t("footer.helpSupport")} href="/help" />
              <MenuItem icon={FileText} label={t("footer.imprint")} href="/legal/impressum" />
            </CardContent>
          </Card>

          {/* Admin link */}
          {(session?.user as { role?: string })?.role === "admin" && (
            <Button variant="outline" className="w-full gap-2 text-sm" asChild>
              <Link href="/admin">
                <BarChart3 className="size-4" />
                {t("profile.adminDashboard")}
              </Link>
            </Button>
          )}

          {/* Logout */}
          <Button
            variant="ghost"
            className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            {t("nav.logout")}
          </Button>
          </>
          )}
        <div className="scroll-end-spacer" aria-hidden />
      </div>
    </PageContainer>
  )
}

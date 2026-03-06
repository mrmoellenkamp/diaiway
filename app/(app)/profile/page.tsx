"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useApp } from "@/lib/app-context"
import { useTakumis } from "@/hooks/use-takumis"

import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import {
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  Edit3,
  Radio,
  Wallet,
  BarChart3,
  Heart,
  Loader2,
  Check,
  X,
} from "lucide-react"

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
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  accent?: boolean
}) {
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
      onClick={() => toast.info("Funktion kommt bald!")}
    >
      {inner}
    </button>
  )
}

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const { role, setRole, setIsLoggedIn } = useApp()
  const { t } = useI18n()
  const { takumis } = useTakumis()
  const router = useRouter()
  const [isLive, setIsLive] = useState(false)
  const isTakumi = role === "takumi"

  // Profile data from DB
  const [profileLoading, setProfileLoading] = useState(true)
  const [dbName, setDbName] = useState("")
  const [dbEmail, setDbEmail] = useState("")
  const [dbImage, setDbImage] = useState("")
  const [favorites, setFavorites] = useState<string[]>([])
  const [completedSessions, setCompletedSessions] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)

  // Edit state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState("")
  const [editImage, setEditImage] = useState("")
  const [isEditingImage, setIsEditingImage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Load full profile + booking stats from MongoDB
  useEffect(() => {
    async function loadProfile() {
      try {
        const [profileRes, bookingsRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/bookings"),
        ])
        if (profileRes.ok) {
          const data = await profileRes.json()
          setDbName(data.name || "")
          setDbEmail(data.email || "")
          setDbImage(data.image || "")
          setFavorites(data.favorites || [])
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
      } catch {
        // fall back to defaults (0)
      } finally {
        setProfileLoading(false)
      }
    }
    if (session?.user) {
      loadProfile()
    } else if (status !== "loading") {
      setProfileLoading(false)
    }
  }, [session, status])

  // Prefer DB data, fall back to session
  const userName = dbName || session?.user?.name || "Nutzer"
  const userEmail = dbEmail || session?.user?.email || ""
  const userImage = dbImage || session?.user?.image || ""
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()

  const favoriteTakumis = takumis.filter((t) => favorites.includes(t.id))

  async function handleSaveProfile() {
    const updates: Record<string, string> = {}
    if (isEditingName && editName.trim() && editName.trim() !== userName) {
      if (editName.trim().length < 2) {
        toast.error("Name muss mindestens 2 Zeichen lang sein.")
        return
      }
      updates.name = editName.trim()
    }
    if (isEditingImage && editImage !== userImage) {
      updates.image = editImage
    }
    if (Object.keys(updates).length === 0) {
      toast.info("Keine Aenderungen vorhanden.")
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
        if (updates.name) {
          setDbName(updates.name)
          await updateSession({ name: updates.name })
        }
        if (updates.image !== undefined) {
          setDbImage(updates.image)
          await updateSession({ image: updates.image })
        }
        setIsEditingName(false)
        setIsEditingImage(false)
        setHasUnsavedChanges(false)
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogout() {
    setIsLoggedIn(false)
    await signOut({ redirect: false })
    toast.success("Du wurdest abgemeldet.")
    router.push("/")
    router.refresh()
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Loading state */}
        {profileLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
        <>
        {/* User header */}
        <div className="flex flex-col items-center gap-3 pt-2">
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

            {isEditingImage && (
              <div className="flex items-center gap-2 w-full max-w-xs">
                <Input
                  value={editImage}
                  onChange={(e) => { setEditImage(e.target.value); setHasUnsavedChanges(true) }}
                  placeholder="Bild-URL eingeben..."
                  className="h-8 text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  onClick={() => { setIsEditingImage(false); setEditImage("") }}
                >
                  <X className="size-3.5 text-muted-foreground" />
                </Button>
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
                  <Edit3 className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
              <p className="text-xs text-muted-foreground">{userEmail}</p>
              <div className="mt-1 flex items-center gap-2">
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
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Aenderungen speichern
                </>
              )}
            </Button>
          )}

          {/* Stats */}
          <Card className="border-border/60 gap-0 py-0">
            <CardContent className="flex items-center justify-around p-4">
              <StatBox label="Sessions" value={String(completedSessions)} />
              <div className="h-8 w-px bg-border" />
              <StatBox label={isTakumi ? "Verdient" : "Ausgegeben"} value={`${totalSpent}\u20AC`} />
              <div className="h-8 w-px bg-border" />
              <StatBox label="Favoriten" value={String(favorites.length)} />
            </CardContent>
          </Card>

          {/* Favorites */}
          {favorites.length > 0 && (
            <Card className="border-border/60 gap-0 py-0">
              <CardContent className="flex flex-col gap-3 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Heart className="size-4 text-destructive" />
                  Favoriten-Takumis
                </h3>
                <div className="flex flex-col gap-2">
                  {favoriteTakumis.map((t) => (
                    <Link
                      key={t.id}
                      href={`/takumi/${t.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/50"
                    >
                      <Avatar className="size-10 border-2 border-primary/10">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {t.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-foreground">{t.name}</span>
                        <span className="text-[11px] text-muted-foreground">{t.subcategory}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{t.rating} / 5</Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Role switcher */}
          <Card className="border-border/60 gap-0 py-0">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Rolle wechseln</span>
                <span className="text-xs text-muted-foreground">
                  Aktuell: {isTakumi ? "Takumi (Experte)" : "Shugyo (Lerner)"}
                </span>
              </div>
              <Switch
                checked={isTakumi}
                onCheckedChange={(checked) => {
                  setRole(checked ? "takumi" : "shugyo")
                  toast.success(checked ? "Du bist jetzt Takumi!" : "Du bist jetzt Shugyo!")
                }}
              />
            </CardContent>
          </Card>

          {/* Go Live toggle (Takumi only) */}
          {isTakumi && (
            <Card className="border-accent/30 bg-accent/5 gap-0 py-0">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Radio className={`size-5 ${isLive ? "text-accent animate-live-pulse" : "text-muted-foreground"}`} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {isLive ? "Du bist Live!" : "Offline"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isLive ? "Shugyo konnen dich jetzt buchen" : "Aktiviere, um Anfragen zu erhalten"}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={isLive}
                  onCheckedChange={(v) => {
                    setIsLive(v)
                    toast.success(v ? "Du bist jetzt Live!" : "Du bist jetzt Offline.")
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Takumi earnings (Takumi only) */}
          {isTakumi && (
            <Card className="border-border/60 gap-0 py-0">
              <CardContent className="flex flex-col gap-3 p-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Wallet className="size-4 text-accent" />
                  Einnahmen
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted p-3">
                    <span className="text-base font-bold text-foreground">{`${totalSpent}\u20AC`}</span>
                    <span className="text-[10px] text-muted-foreground">Gesamt</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted p-3">
                    <span className="text-base font-bold text-foreground">{completedSessions}</span>
                    <span className="text-[10px] text-muted-foreground">Sessions</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted p-3">
                    <span className="text-base font-bold text-foreground">{favorites.length}</span>
                    <span className="text-[10px] text-muted-foreground">Favoriten</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Menu items */}
          <Card className="overflow-hidden border-border/60 gap-0 py-0">
            <CardContent className="flex flex-col p-0 divide-y divide-border">
              <MenuItem icon={Edit3} label={t("profile.editProfile")} href="/profile/edit" accent />
              <MenuItem icon={Calendar} label={t("profile.myBookings")} href="/sessions" />
              <MenuItem icon={CreditCard} label={t("profile.payments")} />
              {isTakumi && (
                <MenuItem icon={BarChart3} label={t("profile.statistics")} />
              )}
              <MenuItem icon={Settings} label={t("common.settings")} />
            </CardContent>
          </Card>

          {/* Admin link */}
          {(session?.user as { role?: string })?.role === "admin" && (
            <Button variant="outline" className="w-full gap-2 text-sm" asChild>
              <Link href="/admin">
                <BarChart3 className="size-4" />
                Admin-Dashboard
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
      </div>
    </PageContainer>
  )
}

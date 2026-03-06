"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useApp } from "@/lib/app-context"
import { categories } from "@/lib/categories"
import { toast } from "sonner"
import {
  ArrowLeft,
  Loader2,
  Save,
  User,
  Briefcase,
  Tag,
  FileText,
  DollarSign,
  ChevronDown,
  Camera,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Upload,
} from "lucide-react"

// -- Availability types --
interface TimeSlot { start: string; end: string }
type Slots = Record<number, TimeSlot[]>
const EMPTY_SLOTS: Slots = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

interface Booking {
  _id: string
  userName: string
  date: string
  startTime: string
  endTime: string
  status: "pending" | "confirmed" | "declined" | "cancelled"
  statusToken: string
}

export default function EditProfilePage() {
  const router = useRouter()
  const { data: session, update: updateSession } = useSession()
  const { role, setRole } = useApp()
  const isTakumi = role === "takumi"
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Base profile
  const [name, setName] = useState("")
  const [image, setImage] = useState("")
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Takumi fields
  const [categorySlug, setCategorySlug] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [bio, setBio] = useState("")
  const [pricePerSession, setPricePerSession] = useState("")
  const [responseTime, setResponseTime] = useState("< 5 Min")
  const [takumiImageUrl, setTakumiImageUrl] = useState("")
  const [takumiExists, setTakumiExists] = useState(false)
  const [loadingTakumi, setLoadingTakumi] = useState(true)

  // Availability
  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS)
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [savingSlots, setSavingSlots] = useState(false)

  // Bookings
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)

  const selectedCategory = categories.find((c) => c.slug === categorySlug)
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  // Load base profile
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/profile")
        if (res.ok) {
          const data = await res.json()
          setName(data.name || "")
          setImage(data.image || "")
        }
      } catch { /* ignore */ }
      finally { setLoadingProfile(false) }
    }
    if (session?.user) load()
    else setLoadingProfile(false)
  }, [session])

  // Load takumi profile
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/takumi-profile")
        if (res.ok) {
          const data = await res.json()
          if (data.exists) {
            setTakumiExists(true)
            setCategorySlug(data.categorySlug || "")
            setSubcategory(data.subcategory || "")
            setBio(data.bio || "")
            setPricePerSession(String(data.pricePerSession || ""))
            setResponseTime(data.responseTime || "< 5 Min")
            setTakumiImageUrl(data.imageUrl || "")
          }
        }
      } catch { /* ignore */ }
      finally { setLoadingTakumi(false) }
    }
    if (session?.user) load()
    else setLoadingTakumi(false)
  }, [session])

  // Load availability
  useEffect(() => {
    if (!session?.user?.id) { setLoadingSlots(false); return }
    fetch(`/api/availability?takumiId=${session.user.id}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || EMPTY_SLOTS))
      .catch(() => {})
      .finally(() => setLoadingSlots(false))
  }, [session])

  // Load bookings
  useEffect(() => {
    if (!session?.user?.id) { setLoadingBookings(false); return }
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setBookings((data.bookings || []).filter((b: Booking) => b.status !== "cancelled")))
      .catch(() => {})
      .finally(() => setLoadingBookings(false))
  }, [session])

  // -- Image upload --
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Nur JPG, PNG, WebP und GIF erlaubt.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maximale Dateigroesse: 5 MB.")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "profiles")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok && data.url) {
        setImage(data.url)
        toast.success("Bild hochgeladen!")
      } else {
        toast.error(data.error || "Upload fehlgeschlagen.")
      }
    } catch {
      toast.error("Netzwerkfehler beim Upload.")
    } finally {
      setUploading(false)
    }
  }

  async function handleTakumiImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Nur JPG, PNG, WebP und GIF erlaubt.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maximale Dateigroesse: 5 MB.")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "experts")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok && data.url) {
        setTakumiImageUrl(data.url)
        toast.success("Experten-Bild hochgeladen!")
      } else {
        toast.error(data.error || "Upload fehlgeschlagen.")
      }
    } catch {
      toast.error("Netzwerkfehler beim Upload.")
    } finally {
      setUploading(false)
    }
  }

  // -- Availability helpers --
  const handleAddSlot = useCallback((day: number) => {
    setSlots((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: "09:00", end: "12:00" }],
    }))
  }, [])

  const handleRemoveSlot = useCallback((day: number, idx: number) => {
    setSlots((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== idx),
    }))
  }, [])

  const handleSlotChange = useCallback((day: number, idx: number, field: "start" | "end", value: string) => {
    setSlots((prev) => ({
      ...prev,
      [day]: prev[day].map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }))
  }, [])

  async function handleSaveAvailability() {
    setSavingSlots(true)
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      })
      const data = await res.json()
      if (res.ok) toast.success("Verfuegbarkeit gespeichert!")
      else toast.error(data.error)
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setSavingSlots(false)
    }
  }

  async function handleBookingAction(bookingId: string, token: string, action: "confirmed" | "declined") {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(action === "confirmed" ? "Buchung bestaetigt!" : "Buchung abgelehnt.")
        setBookings((prev) => prev.map((b) => b._id === bookingId ? { ...b, status: action } : b))
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error("Netzwerkfehler.")
    }
  }

  // -- Save profile --
  async function handleSave() {
    setSaving(true)
    try {
      // 1. Save base profile
      const profilePayload: Record<string, string> = {}
      if (name.trim()) profilePayload.name = name.trim()
      if (image !== undefined) profilePayload.image = image

      if (Object.keys(profilePayload).length > 0) {
        const profileRes = await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profilePayload),
        })
        if (!profileRes.ok) {
          const data = await profileRes.json()
          toast.error(data.error || "Fehler beim Speichern.")
          setSaving(false)
          return
        }
        if (profilePayload.name) {
          await updateSession({ name: profilePayload.name })
        }
      }

      // 2. If Takumi mode, save takumi profile
      if (isTakumi) {
        const takumiRes = await fetch("/api/user/takumi-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || undefined,
            categorySlug: categorySlug || undefined,
            categoryName: selectedCategory?.name || categorySlug || undefined,
            subcategory: subcategory || undefined,
            bio: bio.trim() || undefined,
            pricePerSession: pricePerSession ? Number(pricePerSession) : undefined,
            responseTime,
            imageUrl: takumiImageUrl || undefined,
          }),
        })
        if (!takumiRes.ok) {
          const data = await takumiRes.json()
          toast.error(data.error || "Fehler beim Speichern des Experten-Profils.")
          setSaving(false)
          return
        }
        setTakumiExists(true)
      }

      toast.success("Profil gespeichert!")
      router.push("/profile")
    } catch {
      toast.error("Netzwerkfehler.")
    } finally {
      setSaving(false)
    }
  }

  const isLoading = loadingProfile || loadingTakumi
  const pendingBookings = bookings.filter((b) => b.status === "pending")
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed")

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">Profil bearbeiten</h1>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ===== Base Profile ===== */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-primary" />
                  Persoenliche Daten
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {/* Profile Image Upload */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {image ? (
                      <div className="relative size-24 overflow-hidden rounded-full border-4 border-primary/10">
                        <Image
                          src={image}
                          alt="Profilbild"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <Avatar className="size-24 border-4 border-primary/10">
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 disabled:opacity-50"
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Camera className="size-4" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Klicke auf das Kamera-Symbol zum Hochladen (max. 5 MB)
                  </p>
                </div>

                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dein Name"
                  />
                </div>
              </CardContent>
            </Card>

            {/* ===== Role Toggle ===== */}
            <Card className="border-border/60">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">Takumi-Modus</span>
                  <span className="text-xs text-muted-foreground">
                    Aktivieren, um als Experte sichtbar zu sein
                  </span>
                </div>
                <Switch
                  checked={isTakumi}
                  onCheckedChange={(checked) => setRole(checked ? "takumi" : "shugyo")}
                />
              </CardContent>
            </Card>

            {/* ===== Takumi Profile ===== */}
            {isTakumi && (
              <>
                <Card className="border-accent/30 bg-accent/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Briefcase className="size-4 text-accent" />
                      Experten-Profil
                      {takumiExists && (
                        <Badge variant="outline" className="ml-auto text-[10px] border-primary/30 bg-primary/5 text-primary">
                          Aktiv
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Takumi Image Upload */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Experten-Bild</label>
                      <div className="flex items-center gap-3">
                        {takumiImageUrl ? (
                          <div className="relative size-16 overflow-hidden rounded-lg border border-border">
                            <Image
                              src={takumiImageUrl}
                              alt="Experten-Bild"
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
                            <Upload className="size-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={handleTakumiImageUpload}
                              className="hidden"
                            />
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                              <Camera className="size-3.5" />
                              {takumiImageUrl ? "Bild aendern" : "Bild hochladen"}
                            </span>
                          </label>
                          <p className="text-[10px] text-muted-foreground">Optional. JPG, PNG, WebP (max. 5 MB)</p>
                        </div>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Tag className="size-3" /> Kategorie
                      </label>
                      <div className="relative">
                        <select
                          value={categorySlug}
                          onChange={(e) => {
                            setCategorySlug(e.target.value)
                            setSubcategory("")
                          }}
                          className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Kategorie waehlen...</option>
                          {categories.map((c) => (
                            <option key={c.slug} value={c.slug}>{c.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Subcategory */}
                    {selectedCategory && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Tag className="size-3" /> Fachbereich
                        </label>
                        <div className="relative">
                          <select
                            value={subcategory}
                            onChange={(e) => setSubcategory(e.target.value)}
                            className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Fachbereich waehlen...</option>
                            {selectedCategory.subcategories.map((sub) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Bio */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FileText className="size-3" /> Beschreibung
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, 500))}
                        className="min-h-[100px] w-full resize-none rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Beschreibe deine Expertise, Erfahrung und was Kunden bei dir erwartet..."
                      />
                      <p className="text-[10px] text-muted-foreground">{bio.length}/500 Zeichen</p>
                    </div>

                    {/* Price */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <DollarSign className="size-3" /> Preis pro Session (EUR)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={pricePerSession}
                        onChange={(e) => setPricePerSession(e.target.value)}
                        placeholder="z.B. 45 (optional)"
                      />
                    </div>

                    {/* Response Time */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Antwortzeit</label>
                      <div className="relative">
                        <select
                          value={responseTime}
                          onChange={(e) => setResponseTime(e.target.value)}
                          className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="< 5 Min">{"< 5 Minuten"}</option>
                          <option value="< 15 Min">{"< 15 Minuten"}</option>
                          <option value="< 30 Min">{"< 30 Minuten"}</option>
                          <option value="< 1 Std">{"< 1 Stunde"}</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ===== Pending Bookings ===== */}
                {!loadingBookings && pendingBookings.length > 0 && (
                  <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <AlertCircle className="size-4 text-amber-600" />
                        {pendingBookings.length} offene Anfrage{pendingBookings.length > 1 ? "n" : ""}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {pendingBookings.map((b) => (
                        <div key={b._id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-card p-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground">{b.userName}</span>
                            <span className="text-xs text-muted-foreground">
                              {b.date} / {b.startTime} - {b.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 gap-1 bg-primary text-xs font-semibold text-primary-foreground"
                              onClick={() => handleBookingAction(b._id, b.statusToken, "confirmed")}
                            >
                              <CheckCircle className="size-3" /> Ja
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 border-destructive/30 text-xs font-semibold text-destructive"
                              onClick={() => handleBookingAction(b._id, b.statusToken, "declined")}
                            >
                              <XCircle className="size-3" /> Nein
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* ===== Confirmed Bookings ===== */}
                {!loadingBookings && confirmedBookings.length > 0 && (
                  <Card className="border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Calendar className="size-4 text-primary" />
                        Bestaetigte Termine ({confirmedBookings.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1.5">
                      {confirmedBookings.map((b) => (
                        <div key={b._id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">{b.userName}</span>
                            <span className="text-[11px] text-muted-foreground">{b.date} / {b.startTime}-{b.endTime}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/5 text-primary">
                            Bestaetigt
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* ===== Availability / Weekly Schedule ===== */}
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Clock className="size-4 text-primary" />
                      Woechentliche Verfuegbarkeit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {loadingSlots ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                          <div key={day} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                <span className="inline-block w-6 text-muted-foreground">{DAY_SHORT[day]}</span>{" "}
                                {DAY_NAMES[day]}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 text-xs text-primary"
                                onClick={() => handleAddSlot(day)}
                              >
                                <Plus className="size-3" /> Slot
                              </Button>
                            </div>
                            {(slots[day] || []).length === 0 ? (
                              <p className="pl-7 text-xs italic text-muted-foreground">Nicht verfuegbar</p>
                            ) : (
                              (slots[day] || []).map((slot, idx) => (
                                <div key={idx} className="flex items-center gap-2 pl-7">
                                  <Input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) => handleSlotChange(day, idx, "start", e.target.value)}
                                    className="h-8 w-28 text-xs"
                                  />
                                  <span className="text-xs text-muted-foreground">bis</span>
                                  <Input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) => handleSlotChange(day, idx, "end", e.target.value)}
                                    className="h-8 w-28 text-xs"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7 text-destructive/60 hover:text-destructive"
                                    onClick={() => handleRemoveSlot(day, idx)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              ))
                            )}
                            <div className="h-px bg-border/60" />
                          </div>
                        ))}

                        <Button
                          onClick={handleSaveAvailability}
                          disabled={savingSlots}
                          variant="outline"
                          className="mt-1 w-full gap-2 rounded-xl font-medium"
                        >
                          {savingSlots ? (
                            <><Loader2 className="size-4 animate-spin" /> Wird gespeichert...</>
                          ) : (
                            <><Clock className="size-4" /> Verfuegbarkeit speichern</>
                          )}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* ===== Save Profile Button ===== */}
            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="h-12 w-full gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20"
            >
              {saving ? (
                <><Loader2 className="size-4 animate-spin" /> Wird gespeichert...</>
              ) : (
                <><Save className="size-4" /> Profil speichern</>
              )}
            </Button>

            {isTakumi && !takumiExists && (
              <p className="text-center text-xs text-muted-foreground">
                Beim Speichern wird dein Experten-Profil erstellt und du bist fuer Kunden sichtbar.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

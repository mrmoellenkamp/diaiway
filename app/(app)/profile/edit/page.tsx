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
import { useI18n } from "@/lib/i18n"
import { useCategories } from "@/lib/categories-i18n"
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
  ShieldCheck,
} from "lucide-react"

interface TimeSlot { start: string; end: string }
type Slots = Record<number, TimeSlot[]>
const EMPTY_SLOTS: Slots = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

interface Booking {
  id: string
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
  const { t, locale } = useI18n()
  const categories = useCategories()
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

  // Cancellation policy
  const [cancelFreeHours, setCancelFreeHours] = useState(24)
  const [cancelFeePercent, setCancelFeePercent] = useState(0)

  // Social links
  const [socialInstagram, setSocialInstagram] = useState("")
  const [socialTiktok, setSocialTiktok]       = useState("")
  const [socialFacebook, setSocialFacebook]   = useState("")
  const [socialYoutube, setSocialYoutube]     = useState("")
  const [socialLinkedin, setSocialLinkedin]   = useState("")
  const [socialX, setSocialX]                 = useState("")
  const [socialWebsite, setSocialWebsite]     = useState("")

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

  const DAY_NAMES = locale === "en"
    ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    : locale === "es"
      ? ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
      : ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]
  const DAY_SHORT = locale === "en"
    ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    : locale === "es"
      ? ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"]
      : ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

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
            const cp = data.cancelPolicy || {}
            setCancelFreeHours(typeof cp.freeHours === "number" ? cp.freeHours : 24)
            setCancelFeePercent(typeof cp.feePercent === "number" ? cp.feePercent : 0)
            const sl = data.socialLinks || {}
            setSocialInstagram(sl.instagram || "")
            setSocialTiktok(sl.tiktok || "")
            setSocialFacebook(sl.facebook || "")
            setSocialYoutube(sl.youtube || "")
            setSocialLinkedin(sl.linkedin || "")
            setSocialX(sl.x || "")
            setSocialWebsite(sl.website || "")
          }
        }
      } catch { /* ignore */ }
      finally { setLoadingTakumi(false) }
    }
    if (session?.user) load()
    else setLoadingTakumi(false)
  }, [session])

  useEffect(() => {
    if (!session?.user?.id) { setLoadingSlots(false); return }
    fetch(`/api/availability?takumiId=${session.user.id}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || EMPTY_SLOTS))
      .catch(() => {})
      .finally(() => setLoadingSlots(false))
  }, [session])

  useEffect(() => {
    if (!session?.user?.id) { setLoadingBookings(false); return }
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setBookings((data.bookings || []).filter((b: Booking) => b.status !== "cancelled")))
      .catch(() => {})
      .finally(() => setLoadingBookings(false))
  }, [session])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      toast.error(t("editProfile.fileTypeError"))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("editProfile.fileSizeError"))
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
        toast.success(t("editProfile.uploadSuccess"))
      } else {
        toast.error(data.error || t("editProfile.uploadError"))
      }
    } catch {
      toast.error(t("editProfile.uploadNetworkError"))
    } finally {
      setUploading(false)
    }
  }

  async function handleTakumiImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      toast.error(t("editProfile.fileTypeError"))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("editProfile.fileSizeError"))
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
        toast.success(t("editProfile.expertUploadSuccess"))
      } else {
        toast.error(data.error || t("editProfile.uploadError"))
      }
    } catch {
      toast.error(t("editProfile.uploadNetworkError"))
    } finally {
      setUploading(false)
    }
  }

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
      if (res.ok) toast.success(t("editProfile.availabilitySaved"))
      else toast.error(data.error)
    } catch {
      toast.error(t("common.networkError"))
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
        toast.success(action === "confirmed" ? t("editProfile.bookingConfirmed") : t("editProfile.bookingDeclined"))
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: action } : b))
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error(t("common.networkError"))
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
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
          toast.error(data.error || t("editProfile.saveError"))
          setSaving(false)
          return
        }
        if (profilePayload.name) {
          await updateSession({ name: profilePayload.name })
        }
      }

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
            cancelPolicy: {
              freeHours: cancelFreeHours,
              feePercent: cancelFeePercent,
            },
            socialLinks: {
              instagram: socialInstagram.trim() || undefined,
              tiktok:    socialTiktok.trim()    || undefined,
              facebook:  socialFacebook.trim()  || undefined,
              youtube:   socialYoutube.trim()   || undefined,
              linkedin:  socialLinkedin.trim()  || undefined,
              x:         socialX.trim()         || undefined,
              website:   socialWebsite.trim()   || undefined,
            },
          }),
        })
        if (!takumiRes.ok) {
          const data = await takumiRes.json()
          toast.error(data.error || t("editProfile.expertSaveError"))
          setSaving(false)
          return
        }
        setTakumiExists(true)
      }

      toast.success(t("editProfile.saveSuccess"))
      router.push("/profile")
    } catch {
      toast.error(t("common.networkError"))
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
          <h1 className="text-lg font-semibold">{t("editProfile.title")}</h1>
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
                  {t("editProfile.personalData")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {/* Profile Image Upload */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {image ? (
                      <div className="relative size-24 overflow-hidden rounded-full border-4 border-primary/10">
                        <Image src={image} alt={t("editProfile.personalData")} fill className="object-cover" />
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
                  <p className="text-[10px] text-muted-foreground">{t("editProfile.uploadHint")}</p>
                </div>

                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("register.name")}</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("editProfile.namePlaceholder")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* ===== Role Toggle ===== */}
            <Card className="border-border/60">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{t("editProfile.takumiMode")}</span>
                  <span className="text-xs text-muted-foreground">{t("editProfile.takumiModeDesc")}</span>
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
                      {t("editProfile.expertProfile")}
                      {takumiExists && (
                        <Badge variant="outline" className="ml-auto text-[10px] border-primary/30 bg-primary/5 text-primary">
                          {t("common.active")}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Takumi Image Upload */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t("editProfile.expertImage")}</label>
                      <div className="flex items-center gap-3">
                        {takumiImageUrl ? (
                          <div className="relative size-16 overflow-hidden rounded-lg border border-border">
                            <Image src={takumiImageUrl} alt={t("editProfile.expertImage")} fill className="object-cover" />
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
                              {takumiImageUrl ? t("editProfile.changeImage") : t("editProfile.uploadImage")}
                            </span>
                          </label>
                          <p className="text-[10px] text-muted-foreground">{t("editProfile.imageHint")}</p>
                        </div>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Tag className="size-3" /> {t("editProfile.category")}
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
                          <option value="">{t("editProfile.categoryPlaceholder")}</option>
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
                          <Tag className="size-3" /> {t("editProfile.subcategory")}
                        </label>
                        <div className="relative">
                          <select
                            value={subcategory}
                            onChange={(e) => setSubcategory(e.target.value)}
                            className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">{t("editProfile.subcategoryPlaceholder")}</option>
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
                        <FileText className="size-3" /> {t("editProfile.description")}
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, 500))}
                        className="min-h-[100px] w-full resize-none rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder={t("editProfile.descriptionPlaceholder")}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {t("editProfile.descriptionCount").replace("{count}", String(bio.length))}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <DollarSign className="size-3" /> {t("editProfile.price")}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={pricePerSession}
                        onChange={(e) => setPricePerSession(e.target.value)}
                        placeholder={t("editProfile.pricePlaceholder")}
                      />
                    </div>

                    {/* Response Time */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t("editProfile.responseTime")}</label>
                      <div className="relative">
                        <select
                          value={responseTime}
                          onChange={(e) => setResponseTime(e.target.value)}
                          className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="< 5 Min">{"< 5 Min"}</option>
                          <option value="< 15 Min">{"< 15 Min"}</option>
                          <option value="< 30 Min">{"< 30 Min"}</option>
                          <option value="< 1 Std">{"< 1 h"}</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ===== Social Media ===== */}
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <svg className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      {t("editProfile.socialMedia")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{t("editProfile.socialMediaDesc")}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {[
                      {
                        key: "instagram", label: "Instagram", value: socialInstagram, set: setSocialInstagram,
                        placeholder: "@username oder instagram.com/...",
                        icon: (
                          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        ),
                        color: "text-pink-500",
                      },
                      {
                        key: "tiktok", label: "TikTok", value: socialTiktok, set: setSocialTiktok,
                        placeholder: "@username",
                        icon: (
                          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
                          </svg>
                        ),
                        color: "text-foreground",
                      },
                      {
                        key: "youtube", label: "YouTube", value: socialYoutube, set: setSocialYoutube,
                        placeholder: "@channel oder youtube.com/...",
                        icon: (
                          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
                          </svg>
                        ),
                        color: "text-red-500",
                      },
                      {
                        key: "facebook", label: "Facebook", value: socialFacebook, set: setSocialFacebook,
                        placeholder: "facebook.com/...",
                        icon: (
                          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        ),
                        color: "text-blue-500",
                      },
                      {
                        key: "linkedin", label: "LinkedIn", value: socialLinkedin, set: setSocialLinkedin,
                        placeholder: "linkedin.com/in/...",
                        icon: (
                          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        ),
                        color: "text-blue-600",
                      },
                      {
                        key: "x", label: "X (Twitter)", value: socialX, set: setSocialX,
                        placeholder: "@username",
                        icon: (
                          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        ),
                        color: "text-foreground",
                      },
                      {
                        key: "website", label: "Website", value: socialWebsite, set: setSocialWebsite,
                        placeholder: "https://meinewebsite.de",
                        icon: (
                          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                          </svg>
                        ),
                        color: "text-muted-foreground",
                      },
                    ].map(({ key, label, value, set, placeholder, icon, color }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className={`${color} mt-0.5`}>{icon}</span>
                        <div className="flex flex-1 flex-col gap-0.5">
                          <Input
                            value={value}
                            onChange={(e) => set(e.target.value)}
                            placeholder={placeholder}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* ===== Cancellation Policy ===== */}
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <ShieldCheck className="size-4 text-primary" />
                      {t("editProfile.cancelPolicy")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{t("editProfile.cancelPolicyDesc")}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Free cancellation window */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("editProfile.cancelFreeHours")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[0, 12, 24, 48, 72].map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setCancelFreeHours(h)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              cancelFreeHours === h
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {h === 0
                              ? t("editProfile.cancelNeverFree")
                              : t("editProfile.cancelHours").replace("{h}", String(h))}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fee percentage */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t("editProfile.cancelFeePercent")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[0, 25, 50, 75, 100].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCancelFeePercent(p)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              cancelFeePercent === p
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {p === 0 ? t("editProfile.cancelNoFee") : `${p}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Policy summary */}
                    <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                      {cancelFreeHours === 0
                        ? t("editProfile.cancelSummaryNoFree").replace("{percent}", String(cancelFeePercent))
                        : cancelFeePercent === 0
                          ? t("editProfile.cancelSummaryFreeOnly").replace("{h}", String(cancelFreeHours))
                          : t("editProfile.cancelSummaryFull")
                              .replace("{h}", String(cancelFreeHours))
                              .replace("{percent}", String(cancelFeePercent))}
                    </div>
                  </CardContent>
                </Card>

                {/* ===== Pending Bookings ===== */}
                {!loadingBookings && pendingBookings.length > 0 && (
                  <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <AlertCircle className="size-4 text-amber-600" />
                        {pendingBookings.length === 1
                          ? t("editProfile.pendingRequests").replace("{count}", String(pendingBookings.length))
                          : t("editProfile.pendingRequestsPlural").replace("{count}", String(pendingBookings.length))}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {pendingBookings.map((b) => (
                        <div key={b.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-card p-3">
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
                              onClick={() => handleBookingAction(b.id, b.statusToken, "confirmed")}
                            >
                              <CheckCircle className="size-3" /> {t("common.yes")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 border-destructive/30 text-xs font-semibold text-destructive"
                              onClick={() => handleBookingAction(b.id, b.statusToken, "declined")}
                            >
                              <XCircle className="size-3" /> {t("common.no")}
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
                        {t("editProfile.confirmedAppointments").replace("{count}", String(confirmedBookings.length))}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1.5">
                      {confirmedBookings.map((b) => (
                        <div key={b.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">{b.userName}</span>
                            <span className="text-[11px] text-muted-foreground">{b.date} / {b.startTime}-{b.endTime}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/5 text-primary">
                            {t("editProfile.confirmed")}
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
                      {t("editProfile.weeklyAvailability")}
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
                                <Plus className="size-3" /> {t("editProfile.slot")}
                              </Button>
                            </div>
                            {(slots[day] || []).length === 0 ? (
                              <p className="pl-7 text-xs italic text-muted-foreground">{t("editProfile.notAvailable")}</p>
                            ) : (
                              (slots[day] || []).map((slot, idx) => (
                                <div key={idx} className="flex items-center gap-2 pl-7">
                                  <Input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) => handleSlotChange(day, idx, "start", e.target.value)}
                                    className="h-8 w-28 text-xs"
                                  />
                                  <span className="text-xs text-muted-foreground">{t("editProfile.to")}</span>
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
                            <><Loader2 className="size-4 animate-spin" /> {t("common.saving")}</>
                          ) : (
                            <><Clock className="size-4" /> {t("editProfile.saveAvailability")}</>
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
                <><Loader2 className="size-4 animate-spin" /> {t("common.saving")}</>
              ) : (
                <><Save className="size-4" /> {t("editProfile.saveProfile")}</>
              )}
            </Button>

            {isTakumi && !takumiExists && (
              <p className="text-center text-xs text-muted-foreground">
                {t("editProfile.createExpertHint")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

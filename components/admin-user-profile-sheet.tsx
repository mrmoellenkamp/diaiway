"use client"

import { useEffect, useState, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageUpload } from "@/components/image-upload"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "sonner"
import {
  Loader2, User as UserIcon, Star, FolderOpen, Images, Trash2, Plus, Save,
  Mail, ChevronDown, ChevronRight, FileText,
} from "lucide-react"
import { useCategories } from "@/lib/categories-i18n"

function eur(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100)
}

function InvoiceDataEditor({
  data,
  onChange,
}: {
  data: InvoiceData | null | undefined
  onChange: (d: InvoiceData) => void
}) {
  const d = data || { type: "privat" as const }
  const isCompany = d.type === "unternehmen"
  const update = (k: keyof InvoiceData, v: string | boolean | undefined) =>
    onChange({ ...d, [k]: v })
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/60 p-3">
      <RadioGroup value={d.type || "privat"} onValueChange={(v) => update("type", v as "privat" | "unternehmen")} className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-xs">
          <RadioGroupItem value="privat" />
          Privat
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs">
          <RadioGroupItem value="unternehmen" />
          Unternehmen
        </label>
      </RadioGroup>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Name" value={d.fullName ?? ""} onChange={(e) => update("fullName", e.target.value)} className="h-8 text-xs" />
        <Input placeholder="Straße" value={d.street ?? ""} onChange={(e) => update("street", e.target.value)} className="h-8 text-xs" />
        <Input placeholder="Hausnr." value={d.houseNumber ?? ""} onChange={(e) => update("houseNumber", e.target.value)} className="h-8 text-xs" />
        <Input placeholder="PLZ" value={d.zip ?? ""} onChange={(e) => update("zip", e.target.value)} className="h-8 text-xs" />
        <Input placeholder="Ort" value={d.city ?? ""} onChange={(e) => update("city", e.target.value)} className="h-8 text-xs" />
        <Input placeholder="Land" value={d.country ?? ""} onChange={(e) => update("country", e.target.value)} className="h-8 text-xs" />
        <Input placeholder="E-Mail" value={d.email ?? ""} onChange={(e) => update("email", e.target.value)} className="h-8 text-xs col-span-2" />
      </div>
      {isCompany && (
        <>
          <Input placeholder="Firmenname" value={d.companyName ?? ""} onChange={(e) => update("companyName", e.target.value)} className="h-8 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="USt-IdNr." value={d.vatId ?? ""} onChange={(e) => update("vatId", e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Steuernr." value={d.taxNumber ?? ""} onChange={(e) => update("taxNumber", e.target.value)} className="h-8 text-xs" />
          </div>
          <label className="flex items-center justify-between rounded border border-border/40 px-2 py-1.5 text-xs">
            <span>Kleinunternehmer (§19 UStG)</span>
            <Switch checked={!!d.kleinunternehmer} onCheckedChange={(v) => update("kleinunternehmer", v)} />
          </label>
        </>
      )}
    </div>
  )
}

type InvoiceData = {
  type?: "privat" | "unternehmen"
  fullName?: string
  street?: string
  houseNumber?: string
  zip?: string
  city?: string
  country?: string
  email?: string
  companyName?: string
  vatId?: string
  taxNumber?: string
  kleinunternehmer?: boolean
}

type ProfileData = {
  user: {
    id: string
    name: string
    username: string | null
    email: string
    isVerified: boolean
    image: string
    role: string
    appRole: string
    status: string
    isBanned: boolean
    skillLevel: string | null
    balance: number
    pendingBalance: number
    refundPreference: string
    invoiceData: InvoiceData | null
    languages: string[]
    customerNumber: string | null
    createdAt: string
  }
  expert: {
    id: string
    name: string
    email: string
    avatar: string
    categorySlug: string
    categoryName: string
    subcategory: string
    bio: string
    priceVideo15Min: number
    priceVoice15Min: number
    pricePerSession: number | null
    isLive: boolean
    liveStatus: string | null
    isPro: boolean
    verified: boolean
    responseTime: string
    socialLinks: unknown
    cancelPolicy: unknown
    imageUrl: string
    portfolio: string[]
  } | null
  shugyoProjects: Array<{ id: string; title: string; description: string; imageUrl: string; createdAt: string }>
  takumiPortfolio: Array<{
    id: string
    title: string
    description: string
    imageUrl: string
    category: string
    completionDate: string | null
    createdAt: string
  }>
  availability: { slots: unknown; yearlyRules: unknown; exceptions: unknown; instantSlots: unknown } | null
}

interface AdminUserProfileSheetProps {
  userId: string | null
  userName?: string
  onClose: () => void
  onSaved?: () => void
}

export function AdminUserProfileSheet({
  userId,
  userName = "Profil",
  onClose,
  onSaved,
}: AdminUserProfileSheetProps) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [editUser, setEditUser] = useState<ProfileData["user"] | null>(null)
  const [editExpert, setEditExpert] = useState<ProfileData["expert"] | null>(null)
  const [editShugyo, setEditShugyo] = useState<ProfileData["shugyoProjects"]>([])
  const [editTakumi, setEditTakumi] = useState<ProfileData["takumiPortfolio"]>([])
  const [editAvailability, setEditAvailability] = useState<ProfileData["availability"]>(null)
  const [availabilityJson, setAvailabilityJson] = useState("")
  const categories = useCategories()

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/profile`)
      const json = await res.json()
      if (res.ok) {
        setData(json)
        const u = json.user || {}
        setEditUser({
          ...u,
          languages: Array.isArray(u.languages) ? u.languages : [],
          invoiceData: u.invoiceData && typeof u.invoiceData === "object" ? u.invoiceData : null,
        })
        setEditExpert(json.expert)
        setEditShugyo(json.shugyoProjects ?? [])
        setEditTakumi(json.takumiPortfolio ?? [])
        const av = json.availability ?? null
        setEditAvailability(av)
        setAvailabilityJson(av ? JSON.stringify(av, null, 2) : "{}")
      } else {
        toast.error(json.error ?? "Fehler beim Laden")
      }
    } catch { toast.error("Fehler beim Laden") }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    if (!userId || !editUser) return
    setSaving(true)
    const isAnonymized = editUser.email?.endsWith("@anonymized.local")
    try {
      const userPayload: Record<string, unknown> = {
        name: editUser.name,
        email: editUser.email,
        image: editUser.image,
        role: editUser.role,
        appRole: editUser.appRole,
        status: editUser.status,
        isBanned: editUser.isBanned,
        skillLevel: editUser.skillLevel || null,
        refundPreference: editUser.refundPreference,
        languages: (editUser as { languages?: string[] }).languages ?? [],
        invoiceData: (editUser as { invoiceData?: InvoiceData | null }).invoiceData ?? null,
      }
      if (!isAnonymized) {
        userPayload.username = editUser.username ?? undefined
        userPayload.isVerified = editUser.isVerified
      }
      const payload: Record<string, unknown> = { user: userPayload }
      if (editExpert) {
        payload.expert = {
          name: editExpert.name,
          email: editExpert.email,
          bio: editExpert.bio,
          categorySlug: editExpert.categorySlug,
          categoryName: editExpert.categoryName,
          subcategory: editExpert.subcategory,
          priceVideo15Min: editExpert.priceVideo15Min,
          priceVoice15Min: editExpert.priceVoice15Min,
          pricePerSession: editExpert.pricePerSession,
          isLive: editExpert.isLive,
          liveStatus: editExpert.liveStatus,
          isPro: editExpert.isPro,
          verified: editExpert.verified,
          responseTime: editExpert.responseTime,
          socialLinks: editExpert.socialLinks,
          cancelPolicy: editExpert.cancelPolicy,
          imageUrl: editExpert.imageUrl,
        }
      }
      const shugyoToSave = editShugyo.filter((p) => p.title.trim().length >= 2)
      const takumiToSave = editTakumi.filter((p) => p.title.trim().length >= 2)
      payload.shugyoProjects = shugyoToSave
      payload.takumiPortfolio = takumiToSave
      payload.deleteShugyoIds = (data?.shugyoProjects ?? [])
        .map((p) => p.id)
        .filter((id) => !shugyoToSave.some((p) => p.id === id))
      payload.deleteTakumiIds = (data?.takumiPortfolio ?? [])
        .map((p) => p.id)
        .filter((id) => !takumiToSave.some((p) => p.id === id))

      try {
        const avParsed = JSON.parse(availabilityJson)
        if (avParsed && typeof avParsed === "object") {
          payload.availability = {
            slots: avParsed.slots ?? {},
            yearlyRules: Array.isArray(avParsed.yearlyRules) ? avParsed.yearlyRules : [],
            exceptions: Array.isArray(avParsed.exceptions) ? avParsed.exceptions : [],
            instantSlots: avParsed.instantSlots ?? {},
          }
        }
      } catch {
        toast.error("Verfügbarkeit: Ungültiges JSON.")
        setSaving(false)
        return
      }

      const res = await fetch(`/api/admin/users/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message ?? "Gespeichert")
        void load()
        onSaved?.()
      } else {
        toast.error(json.error ?? "Fehler beim Speichern")
      }
    } catch { toast.error("Fehler beim Speichern") }
    finally { setSaving(false) }
  }

  async function handleSendPasswordReset() {
    if (!userId) return
    setSendingPasswordReset(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/send-password-reset`, { method: "POST" })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message ?? "E-Mail gesendet.")
      } else {
        toast.error(json.error ?? "Fehler beim Senden.")
      }
    } catch {
      toast.error("Fehler beim Senden.")
    } finally {
      setSendingPasswordReset(false)
    }
  }

  function addShugyoProject() {
    setEditShugyo((prev) => [...prev, { id: "", title: "", description: "", imageUrl: "", createdAt: "" }])
  }
  function removeShugyoProject(i: number) {
    setEditShugyo((prev) => prev.filter((_, j) => j !== i))
  }
  function updateShugyoProject(i: number, field: string, value: string) {
    setEditShugyo((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  function addTakumiProject() {
    setEditTakumi((prev) => [
      ...prev,
      { id: "", title: "", description: "", imageUrl: "", category: "", completionDate: null, createdAt: "" },
    ])
  }
  function removeTakumiProject(i: number) {
    setEditTakumi((prev) => prev.filter((_, j) => j !== i))
  }
  function updateTakumiProject(i: number, field: string, value: string | null) {
    setEditTakumi((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  const open = !!userId

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserIcon className="size-5" />
            {userName} – Vollständiges Profil
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <p className="py-8 text-sm text-muted-foreground">Profil konnte nicht geladen werden.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <Tabs defaultValue="user" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="user" className="text-[10px]">User</TabsTrigger>
                <TabsTrigger value="expert" className="text-[10px]">Takumi</TabsTrigger>
                <TabsTrigger value="shugyo" className="text-[10px]">Shugyo</TabsTrigger>
                <TabsTrigger value="takumi" className="text-[10px]">Portfolio</TabsTrigger>
                <TabsTrigger value="availability" className="text-[10px]">Verfügbarkeit</TabsTrigger>
              </TabsList>

              <TabsContent value="user" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Nutzerdaten</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {editUser && (
                      <>
                        {editUser.email?.endsWith("@anonymized.local") && (
                          <p className="col-span-full text-xs text-amber-600 dark:text-amber-500 mb-2">
                            Anonymisierter Nutzer — Username und Verifizierung können nicht geändert werden.
                          </p>
                        )}
                        <div>
                          <Label className="text-xs">Profilbild</Label>
                          <ImageUpload
                            value={editUser.image || ""}
                            onChange={(url) => setEditUser({ ...editUser, image: url })}
                            folder="profiles"
                            variant="avatar"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={editUser.name}
                            onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        {!editUser.email?.endsWith("@anonymized.local") && (
                          <div>
                            <Label className="text-xs">Username</Label>
                            <Input
                              value={editUser.username ?? ""}
                              onChange={(e) => setEditUser({ ...editUser, username: e.target.value || null })}
                              placeholder="z.B. max_mueller"
                              className="h-9"
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-xs">E-Mail</Label>
                          <Input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            value={editUser.email}
                            onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                            className="h-9"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">System-Rolle</Label>
                            <select
                              value={editUser.role}
                              onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">App-Rolle</Label>
                            <select
                              value={editUser.appRole}
                              onChange={(e) => setEditUser({ ...editUser, appRole: e.target.value })}
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="shugyo">Shugyo</option>
                              <option value="takumi">Takumi</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Status</Label>
                            <select
                              value={editUser.status}
                              onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="active">active</option>
                              <option value="paused">paused</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <input
                              type="checkbox"
                              id="isBanned"
                              checked={editUser.isBanned}
                              onChange={(e) => setEditUser({ ...editUser, isBanned: e.target.checked })}
                              className="rounded border-input"
                            />
                            <Label htmlFor="isBanned" className="text-xs">Gesperrt</Label>
                          </div>
                          {!editUser.email?.endsWith("@anonymized.local") && (
                            <div className="flex items-center gap-2 pt-2">
                              <input
                                type="checkbox"
                                id="isVerified"
                                checked={editUser.isVerified}
                                onChange={(e) => setEditUser({ ...editUser, isVerified: e.target.checked })}
                                className="rounded border-input"
                              />
                              <Label htmlFor="isVerified" className="text-xs">Verifiziert</Label>
                            </div>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">Kenntnisstufe (Shugyo)</Label>
                          <select
                            value={editUser.skillLevel || ""}
                            onChange={(e) => setEditUser({ ...editUser, skillLevel: e.target.value || null })}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="">–</option>
                            <option value="NEULING">Neuling</option>
                            <option value="FORTGESCHRITTEN">Fortgeschritten</option>
                            <option value="PROFI">Profi</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Sprachen</Label>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {(["de", "en", "es", "fr", "it"] as const).map((lang) => {
                              const langs = (editUser as { languages?: string[] }).languages ?? []
                              const isSelected = langs.includes(lang)
                              return (
                                <button
                                  key={lang}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected ? langs.filter((l) => l !== lang) : [...langs, lang]
                                    setEditUser({ ...editUser, languages: next } as typeof editUser)
                                  }}
                                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  {lang.toUpperCase()}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <Collapsible open={invoiceOpen} onOpenChange={setInvoiceOpen}>
                          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                            {invoiceOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            <FileText className="size-3.5" />
                            Rechnungsdaten
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <InvoiceDataEditor
                              data={(editUser as { invoiceData?: InvoiceData | null }).invoiceData}
                              onChange={(d) => setEditUser({ ...editUser, invoiceData: d } as typeof editUser)}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                        {!editUser.email?.endsWith("@anonymized.local") && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => handleSendPasswordReset()}
                            disabled={sendingPasswordReset}
                          >
                            {sendingPasswordReset ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Mail className="size-4" />
                            )}
                            Passwort zurücksetzen (E-Mail senden)
                          </Button>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          Guthaben: {eur(editUser.balance)} · Pending: {eur(editUser.pendingBalance)}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expert" className="mt-4">
                {editExpert ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="size-4" />
                        Experten-Profil (Takumi)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div>
                        <Label className="text-xs">Bild</Label>
                        <ImageUpload
                          value={editExpert.imageUrl || ""}
                          onChange={(url) => setEditExpert({ ...editExpert, imageUrl: url })}
                          folder="experts"
                          variant="avatar"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={editExpert.name}
                          onChange={(e) => setEditExpert({ ...editExpert, name: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Bio</Label>
                        <textarea
                          value={editExpert.bio}
                          onChange={(e) => setEditExpert({ ...editExpert, bio: e.target.value })}
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          autoCorrect="on"
                          spellCheck={true}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Kategorie</Label>
                        <select
                          value={editExpert.categorySlug}
                          onChange={(e) => {
                            const cat = categories.find((c) => c.slug === e.target.value)
                            setEditExpert({
                              ...editExpert,
                              categorySlug: e.target.value,
                              categoryName: cat?.name ?? editExpert.categoryName,
                              subcategory: cat?.subcategories[0] ?? "",
                            })
                          }}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {categories.map((c) => (
                            <option key={c.slug} value={c.slug}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Unterkategorie</Label>
                        <Input
                          value={editExpert.subcategory}
                          onChange={(e) => setEditExpert({ ...editExpert, subcategory: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Video €/15min</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={editExpert.priceVideo15Min ?? ""}
                            onChange={(e) =>
                              setEditExpert({ ...editExpert, priceVideo15Min: parseFloat(e.target.value) || 0 })
                            }
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Voice €/15min</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={editExpert.priceVoice15Min ?? ""}
                            onChange={(e) =>
                              setEditExpert({ ...editExpert, priceVoice15Min: parseFloat(e.target.value) || 0 })
                            }
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Session €</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={editExpert.pricePerSession ?? ""}
                            onChange={(e) =>
                              setEditExpert({
                                ...editExpert,
                                pricePerSession: e.target.value ? parseInt(e.target.value, 10) : null,
                              })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editExpert.isLive}
                            onChange={(e) => setEditExpert({ ...editExpert, isLive: e.target.checked })}
                            className="rounded border-input"
                          />
                          <span className="text-xs">isLive</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editExpert.isPro}
                            onChange={(e) => setEditExpert({ ...editExpert, isPro: e.target.checked })}
                            className="rounded border-input"
                          />
                          <span className="text-xs">isPro</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editExpert.verified}
                            onChange={(e) => setEditExpert({ ...editExpert, verified: e.target.checked })}
                            className="rounded border-input"
                          />
                          <span className="text-xs">verified</span>
                        </label>
                      </div>
                      <div>
                        <Label className="text-xs">Response-Zeit</Label>
                        <select
                          value={editExpert.responseTime ?? "< 5 Min"}
                          onChange={(e) => setEditExpert({ ...editExpert, responseTime: e.target.value })}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="< 5 Min">&lt; 5 Min</option>
                          <option value="< 15 Min">&lt; 15 Min</option>
                          <option value="< 1 Std">&lt; 1 Std</option>
                          <option value="< 24 Std">&lt; 24 Std</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Social Links</Label>
                        <div className="grid grid-cols-1 gap-1.5 mt-1">
                          {(["instagram", "tiktok", "facebook", "youtube", "linkedin", "x", "website"] as const).map((key) => {
                            const sl = (editExpert.socialLinks || {}) as Record<string, string>
                            return (
                              <Input
                                key={key}
                                placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                                value={sl[key] ?? ""}
                                onChange={(e) =>
                                  setEditExpert({
                                    ...editExpert,
                                    socialLinks: { ...sl, [key]: e.target.value },
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            )
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground">Kein Takumi-Profil (Nutzer ist Shugyo).</p>
                )}
              </TabsContent>

              <TabsContent value="shugyo" className="mt-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FolderOpen className="size-4" />
                      Shugyo-Projekte ({editShugyo.length})
                    </CardTitle>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addShugyoProject}>
                      <Plus className="size-3" /> Hinzufügen
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {editShugyo.map((p, i) => (
                      <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Projekt {i + 1}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6 text-destructive hover:text-destructive"
                            onClick={() => removeShugyoProject(i)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Titel"
                          value={p.title}
                          onChange={(e) => updateShugyoProject(i, "title", e.target.value)}
                          className="h-8 text-sm"
                        />
                        <textarea
                          placeholder="Beschreibung"
                          value={p.description}
                          onChange={(e) => updateShugyoProject(i, "description", e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                        />
                        <ImageUpload
                          value={p.imageUrl}
                          onChange={(url) => updateShugyoProject(i, "imageUrl", url)}
                          folder="shugyo-projects"
                          variant="card"
                        />
                      </div>
                    ))}
                    {editShugyo.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Keine Projekte.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="takumi" className="mt-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Images className="size-4" />
                      Takumi-Portfolio ({editTakumi.length})
                    </CardTitle>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addTakumiProject}>
                      <Plus className="size-3" /> Hinzufügen
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {editTakumi.map((p, i) => (
                      <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Portfolio {i + 1}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6 text-destructive hover:text-destructive"
                            onClick={() => removeTakumiProject(i)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Titel"
                          value={p.title}
                          onChange={(e) => updateTakumiProject(i, "title", e.target.value)}
                          className="h-8 text-sm"
                        />
                        <textarea
                          placeholder="Beschreibung"
                          value={p.description}
                          onChange={(e) => updateTakumiProject(i, "description", e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                        />
                        <select
                          value={p.category}
                          onChange={(e) => updateTakumiProject(i, "category", e.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">Kategorie</option>
                          {categories.map((c) => (
                            <option key={c.slug} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        <ImageUpload
                          value={p.imageUrl}
                          onChange={(url) => updateTakumiProject(i, "imageUrl", url)}
                          folder="takumi-portfolio"
                          variant="card"
                        />
                      </div>
                    ))}
                    {editTakumi.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Keine Portfolio-Einträge.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="availability" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Verfügbarkeit (JSON)</CardTitle>
                    <p className="text-[11px] text-muted-foreground">
                      slots, yearlyRules, exceptions, instantSlots. Bei Speichern wird das JSON validiert.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <textarea
                      value={availabilityJson}
                      onChange={(e) => setAvailabilityJson(e.target.value)}
                      rows={12}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                      spellCheck={false}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Button
              className="w-full gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Speichern
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { categories } from "@/lib/categories"
import {
  ArrowLeft,
  Users,
  DollarSign,
  AlertTriangle,
  Database,
  Loader2,
  UserPlus,
  BarChart3,
} from "lucide-react"
import { ImageUpload } from "@/components/image-upload"

export default function AdminPage() {
  const router = useRouter()
  const { data: session } = useSession()

  // Middleware already blocks non-admin users, this is a UI safeguard
  const adminName = session?.user?.name || "Admin"
  const [isSeeding, setIsSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    categorySlug: "elektronik",
    subcategory: "",
    bio: "",
    pricePerSession: "49",
    imageUrl: "",
    isLive: false,
  })

  async function handleAddExpert(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.subcategory || !form.bio) {
      toast.error("Bitte alle Pflichtfelder ausfuellen.")
      return
    }
    setIsAdding(true)
    const cat = categories.find((c) => c.slug === form.categorySlug)
    try {
      const res = await fetch("/api/takumis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          categoryName: cat?.name ?? form.categorySlug,
          pricePerSession: Number(form.pricePerSession),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setForm({ name: "", email: "", categorySlug: "elektronik", subcategory: "", bio: "", pricePerSession: "49", imageUrl: "", isLive: false })
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Netzwerkfehler")
    } finally {
      setIsAdding(false)
    }
  }

  async function handleReset() {
    if (!confirm("ACHTUNG: Alle Daten (Nutzer, Experten, Buchungen) werden unwiderruflich geloescht. Fortfahren?")) return
    setIsResetting(true)
    try {
      const res = await fetch("/api/admin/reset-db", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setSeedResult(null)
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error("Netzwerkfehler")
    } finally {
      setIsResetting(false)
    }
  }

  async function handleSeed() {
    setIsSeeding(true)
    setSeedResult(null)
    try {
      const res = await fetch("/api/takumis/seed", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setSeedResult(`${data.count} Experten erfolgreich geschrieben.`)
        toast.success(data.message)
      } else {
        setSeedResult(`Fehler: ${data.error}`)
        toast.error(data.error)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Netzwerkfehler"
      setSeedResult(`Fehler: ${msg}`)
      toast.error(msg)
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageContainer>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-semibold">Admin-Dashboard</h1>
            <Badge variant="outline" className="ml-auto border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
              Admin
            </Badge>
          </div>
          {/* Admin welcome */}
          <p className="text-xs text-muted-foreground">
            Eingeloggt als <span className="font-semibold text-foreground">{adminName}</span>
          </p>
          {/* Database Seed Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="size-4 text-primary" />
                Datenbank
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Schreibe die Test-Experten in die PostgreSQL-Datenbank. Bestehende Seed-Experten werden dabei überschrieben.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleSeed}
                  disabled={isSeeding || isResetting}
                  className="h-10 flex-1 gap-2 rounded-lg bg-primary font-semibold text-primary-foreground"
                >
                  {isSeeding ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Schreibe...
                    </>
                  ) : (
                    <>
                      <Database className="size-4" />
                      Experten seeden
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleReset}
                  disabled={isResetting || isSeeding}
                  variant="destructive"
                  className="h-10 flex-1 gap-2 rounded-lg font-semibold"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Loesche...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-4" />
                      DB zuruecksetzen
                    </>
                  )}
                </Button>
              </div>
              {seedResult && (
                <p className={`text-xs font-medium ${seedResult.startsWith("Fehler") ? "text-destructive" : "text-accent"}`}>
                  {seedResult}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Add Expert Form */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserPlus className="size-4 text-primary" />
                Neuen Experten hinzufuegen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddExpert} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name" className="text-xs">Name *</Label>
                  <Input
                    id="name"
                    placeholder="z.B. Hans Meier"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-xs">E-Mail (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="expert@domain.de"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="category" className="text-xs">Kategorie *</Label>
                    <select
                      id="category"
                      value={form.categorySlug}
                      onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sub" className="text-xs">Fachgebiet *</Label>
                    <Input
                      id="sub"
                      placeholder="z.B. Smartphone-Reparatur"
                      value={form.subcategory}
                      onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bio" className="text-xs">Kurzbio *</Label>
                  <textarea
                    id="bio"
                    placeholder="Erfahrung, Qualifikationen, Spezialgebiete..."
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={3}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="price" className="text-xs">Preis / 30 Min (€)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={1}
                    value={form.pricePerSession}
                    onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Profilbild (optional)</Label>
                  <ImageUpload
                    value={form.imageUrl}
                    onChange={(url) => setForm({ ...form, imageUrl: url })}
                    folder="experts"
                    variant="card"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="live"
                    checked={form.isLive}
                    onCheckedChange={(v) => setForm({ ...form, isLive: v })}
                  />
                  <Label htmlFor="live" className="text-xs">Sofort als Live markieren</Label>
                </div>
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="h-10 gap-2 rounded-lg bg-primary font-semibold text-primary-foreground"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Experte speichern
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Dashboard Preview -- data will come from real analytics */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="size-4 text-muted-foreground" />
                Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Statistiken, Umsatz-Charts und Live-Session-Uebersichten werden hier angezeigt, sobald erste Buchungen stattfinden.
              </p>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="border-border/60 gap-0 py-0">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold">Schnellaktionen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4 pb-4">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                <Users className="size-3.5" />
                Alle Nutzer anzeigen
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                <DollarSign className="size-3.5" />
                Auszahlungen verwalten
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs text-destructive hover:text-destructive">
                <AlertTriangle className="size-3.5" />
                Gemeldete Sessions prufen
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  )
}

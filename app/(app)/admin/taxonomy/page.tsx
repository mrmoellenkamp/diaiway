"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { TAXONOMY_ICON_KEYS } from "@/lib/taxonomy-icons"
import { TaxonomyCategoryIcon } from "@/components/taxonomy-category-icon"
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Upload,
  RefreshCw,
  Tags,
} from "lucide-react"

type AdminSpecialty = { id: string; name: string; sortOrder: number; isActive: boolean }
type AdminCategory = {
  id: string
  slug: string
  name: string
  description: string
  iconKey: string
  iconImageUrl: string | null
  color: string
  sortOrder: number
  isActive: boolean
  expertCount: number
  specialties: AdminSpecialty[]
}

export default function AdminTaxonomyPage() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newSpecName, setNewSpecName] = useState("")

  const [formNew, setFormNew] = useState({
    name: "",
    slug: "",
    description: "",
    color: "#64748b",
    iconKey: "Briefcase" as string,
  })

  const [formEdit, setFormEdit] = useState<Partial<AdminCategory> & { id?: string }>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/taxonomy/categories")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen")
      const list = (data.categories ?? []) as AdminCategory[]
      setCategories(list)
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = categories.find((c) => c.id === selectedId) ?? null

  async function handleBackfill() {
    try {
      const res = await fetch("/api/admin/taxonomy/backfill", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Legacy-Zuordnungen: ${data.updated} Experten aktualisiert.`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill fehlgeschlagen")
    }
  }

  async function createCategory() {
    if (!formNew.name.trim()) {
      toast.error("Name erforderlich")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/taxonomy/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formNew.name.trim(),
          slug: formNew.slug.trim() || undefined,
          description: formNew.description.trim(),
          color: formNew.color,
          iconKey: formNew.iconKey,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Kategorie angelegt")
      setNewOpen(false)
      setFormNew({ name: "", slug: "", description: "", color: "#64748b", iconKey: "Briefcase" })
      await load()
      if (data.category?.id) setSelectedId(data.category.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSaving(false)
    }
  }

  async function patchCategory(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/taxonomy/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data
  }

  async function saveEdit() {
    if (!formEdit.id) return
    setSaving(true)
    try {
      await patchCategory(formEdit.id, {
        name: formEdit.name,
        slug: formEdit.slug,
        description: formEdit.description,
        color: formEdit.color,
        iconKey: formEdit.iconKey,
        iconImageUrl: formEdit.iconImageUrl,
        sortOrder: formEdit.sortOrder,
        isActive: formEdit.isActive,
      })
      toast.success("Gespeichert")
      setEditOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSaving(false)
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Kategorie wirklich löschen oder deaktivieren?")) return
    const res = await fetch(`/api/admin/taxonomy/categories/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error)
      return
    }
    toast.success(data.soft ? "Kategorie deaktiviert" : "Gelöscht")
    setSelectedId(null)
    load()
  }

  async function addSpecialty() {
    if (!selected || !newSpecName.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/taxonomy/specialties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: selected.id, name: newSpecName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewSpecName("")
      toast.success("Fachbereich angelegt")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setSaving(false)
    }
  }

  async function patchSpecialty(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/taxonomy/specialties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    load()
  }

  async function deleteSpecialty(id: string) {
    if (!confirm("Fachbereich löschen oder deaktivieren?")) return
    const res = await fetch(`/api/admin/taxonomy/specialties/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error)
      return
    }
    load()
  }

  async function uploadIcon(file: File, categoryId: string) {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("categoryId", categoryId)
    const res = await fetch("/api/admin/taxonomy/category-icon", { method: "POST", body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data.url as string
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-4 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/admin">
              <ArrowLeft className="size-4" />
              Admin
            </Link>
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Tags className="size-5" />
            Kategorien & Fachbereiche
          </h1>
          <Button variant="outline" size="sm" className="gap-1 ml-auto" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
          <Button variant="secondary" size="sm" onClick={handleBackfill}>
            Legacy-Takumis zuordnen
          </Button>
          <Button size="sm" className="gap-1" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Neue Kategorie
          </Button>
        </div>

        {loading && categories.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Kategorien</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                      selectedId === c.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${c.color}18` }}
                    >
                      <TaxonomyCategoryIcon iconKey={c.iconKey} iconImageUrl={c.iconImageUrl} color={c.color} size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {c.slug} · {c.expertCount} Takumis
                        {!c.isActive && " · inaktiv"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 size-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFormEdit({ ...c })
                        setEditOpen(true)
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Fachbereiche {selected ? `— ${selected.name}` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {!selected ? (
                  <p className="text-sm text-muted-foreground">Bitte links eine Kategorie wählen.</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Neuer Fachbereich…"
                        value={newSpecName}
                        onChange={(e) => setNewSpecName(e.target.value)}
                        className="h-9"
                      />
                      <Button type="button" size="sm" className="shrink-0" onClick={addSpecialty} disabled={saving}>
                        Hinzufügen
                      </Button>
                    </div>
                    <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
                      {selected.specialties.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
                        >
                          <Input
                            className="h-8 flex-1 text-sm"
                            value={s.name}
                            onChange={(e) => {
                              const v = e.target.value
                              setCategories((prev) =>
                                prev.map((c) =>
                                  c.id !== selected.id
                                    ? c
                                    : {
                                        ...c,
                                        specialties: c.specialties.map((x) =>
                                          x.id === s.id ? { ...x, name: v } : x,
                                        ),
                                      },
                                ),
                              )
                            }}
                            onBlur={(e) => void patchSpecialty(s.id, { name: e.target.value.trim() || s.name })}
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={s.isActive}
                              onCheckedChange={(v) => patchSpecialty(s.id, { isActive: v })}
                            />
                            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => deleteSpecialty(s.id)}>
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => selected && deleteCategory(selected.id)}>
                      Kategorie löschen / deaktivieren
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Neue Kategorie</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div>
                <Label>Name</Label>
                <Input value={formNew.name} onChange={(e) => setFormNew({ ...formNew, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Slug (optional, auto wenn leer)</Label>
                <Input value={formNew.slug} onChange={(e) => setFormNew({ ...formNew, slug: e.target.value })} className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label>Beschreibung</Label>
                <Input value={formNew.description} onChange={(e) => setFormNew({ ...formNew, description: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Farbe</Label>
                <Input type="color" value={formNew.color} onChange={(e) => setFormNew({ ...formNew, color: e.target.value })} className="mt-1 h-10 w-full" />
              </div>
              <div>
                <Label>Icon (Lucide)</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formNew.iconKey}
                  onChange={(e) => setFormNew({ ...formNew, iconKey: e.target.value })}
                >
                  {TAXONOMY_ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={createCategory} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Anlegen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Kategorie bearbeiten</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 py-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formEdit.name ?? ""}
                  onChange={(e) => setFormEdit({ ...formEdit, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={formEdit.slug ?? ""}
                  onChange={(e) => setFormEdit({ ...formEdit, slug: e.target.value })}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label>Beschreibung</Label>
                <Input
                  value={formEdit.description ?? ""}
                  onChange={(e) => setFormEdit({ ...formEdit, description: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Sortierung (Zahl)</Label>
                <Input
                  type="number"
                  value={formEdit.sortOrder ?? 0}
                  onChange={(e) => setFormEdit({ ...formEdit, sortOrder: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Farbe</Label>
                <Input
                  type="color"
                  value={formEdit.color ?? "#64748b"}
                  onChange={(e) => setFormEdit({ ...formEdit, color: e.target.value })}
                  className="mt-1 h-10 w-full"
                />
              </div>
              <div>
                <Label>Lucide-Icon</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formEdit.iconKey ?? "Briefcase"}
                  onChange={(e) => setFormEdit({ ...formEdit, iconKey: e.target.value })}
                >
                  {TAXONOMY_ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Eigenes Icon (Bild)</Label>
                {formEdit.iconImageUrl ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formEdit.iconImageUrl} alt="" className="size-12 rounded object-contain border" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setFormEdit({ ...formEdit, iconImageUrl: null })}>
                      Bibliotheks-Icon nutzen
                    </Button>
                  </div>
                ) : null}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
                  <Upload className="size-4" />
                  <span>Datei hochladen</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f || !formEdit.id) return
                      try {
                        const url = await uploadIcon(f, formEdit.id)
                        setFormEdit({ ...formEdit, iconImageUrl: url })
                        await patchCategory(formEdit.id, { iconImageUrl: url })
                        toast.success("Icon gespeichert")
                        load()
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen")
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Aktiv</Label>
                <Switch
                  checked={formEdit.isActive !== false}
                  onCheckedChange={(v) => setFormEdit({ ...formEdit, isActive: v })}
                />
              </div>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Speichern"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </PageContainer>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
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
  GripVertical,
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

function SortableCategoryRow({
  category: c,
  isSelected,
  onSelect,
  onEdit,
}: {
  category: AdminCategory
  isSelected: boolean
  onSelect: () => void
  onEdit: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-1 rounded-lg border p-2 text-sm transition-colors sm:flex-nowrap md:p-3",
        isSelected ? "border-primary bg-[rgba(6,78,59,0.05)]" : "border-[rgba(231,229,227,0.6)]",
        isDragging && "z-10 bg-card shadow-lg ring-2 ring-[rgba(6,78,59,0.25)]",
      )}
    >
      <button
        type="button"
        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Kategorie verschieben"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-[rgba(245,245,244,0.4)]"
      >
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${c.color}18` }}
        >
          <TaxonomyCategoryIcon iconKey={c.iconKey} iconImageUrl={c.iconImageUrl} color={c.color} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{c.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {c.slug} · {c.expertCount} Takumis
            {!c.isActive && " · inaktiv"}
          </div>
        </div>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={onEdit}>
        <Pencil className="size-3.5" />
      </Button>
    </div>
  )
}

function SortableSpecialtyRow({
  specialty: s,
  onNameChange,
  onNameBlur,
  onToggleActive,
  onDelete,
}: {
  specialty: AdminSpecialty
  onNameChange: (specialtyId: string, name: string) => void
  onNameBlur: (specialtyId: string, name: string) => void
  onToggleActive: (specialtyId: string, v: boolean) => void
  onDelete: (specialtyId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 rounded-md border border-[rgba(231,229,227,0.5)] p-2 text-sm sm:flex-row sm:items-center sm:gap-2 sm:px-3 sm:py-2",
        isDragging && "z-10 bg-card shadow-md ring-2 ring-[rgba(6,78,59,0.2)]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Fachbereich verschieben"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Input
          className="h-8 min-w-0 flex-1 text-sm"
          value={s.name}
          onChange={(e) => onNameChange(s.id, e.target.value)}
          onBlur={(e) => onNameBlur(s.id, e.target.value.trim() || s.name)}
        />
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[rgba(231,229,227,0.4)] pt-2 sm:border-t-0 sm:pt-0">
        <Switch checked={s.isActive} onCheckedChange={(v) => onToggleActive(s.id, v)} />
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onDelete(s.id)}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  )
}

export default function AdminTaxonomyPage() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<AdminCategory[]>([])
  /** DB-Migration fehlt (TaxonomyCategory / TaxonomySpecialty) */
  const [schemaBlockMessage, setSchemaBlockMessage] = useState<string | null>(null)
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

      if (data.schemaMissing && typeof data.schemaMessage === "string") {
        setSchemaBlockMessage(data.schemaMessage)
        setCategories([])
        setSelectedId(null)
        return
      }

      setSchemaBlockMessage(null)
      const list = (data.categories ?? []) as AdminCategory[]
      setCategories(list)
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (e) {
      setSchemaBlockMessage(null)
      toast.error(e instanceof Error ? e.message : "Fehler beim Laden.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const persistCategoryOrder = useCallback(
    async (ids: string[]) => {
      try {
        const res = await fetch("/api/admin/taxonomy/categories/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Speichern fehlgeschlagen")
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reihenfolge der Kategorien speichern fehlgeschlagen")
        load()
      }
    },
    [load],
  )

  const persistSpecialtyOrder = useCallback(
    async (categoryId: string, ids: string[]) => {
      try {
        const res = await fetch("/api/admin/taxonomy/specialties/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId, ids }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Speichern fehlgeschlagen")
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reihenfolge der Fachbereiche speichern fehlgeschlagen")
        load()
      }
    },
    [load],
  )

  const handleCategoryDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = categories.findIndex((c) => c.id === active.id)
      const newIndex = categories.findIndex((c) => c.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      const next = arrayMove(categories, oldIndex, newIndex)
      setCategories(next)
      void persistCategoryOrder(next.map((c) => c.id))
    },
    [categories, persistCategoryOrder],
  )

  const handleSpecialtyDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !selectedId) return
      const cat = categories.find((c) => c.id === selectedId)
      if (!cat) return
      const oldIndex = cat.specialties.findIndex((s) => s.id === active.id)
      const newIndex = cat.specialties.findIndex((s) => s.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      const newSpecs = arrayMove(cat.specialties, oldIndex, newIndex)
      setCategories((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, specialties: newSpecs } : c)),
      )
      void persistSpecialtyOrder(selectedId, newSpecs.map((s) => s.id))
    },
    [categories, selectedId, persistSpecialtyOrder],
  )

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
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBackfill}
            disabled={!!schemaBlockMessage}
            title={schemaBlockMessage ?? undefined}
          >
            Legacy-Takumis zuordnen
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setNewOpen(true)}
            disabled={!!schemaBlockMessage}
            title={schemaBlockMessage ?? undefined}
          >
            <Plus className="size-4" />
            Neue Kategorie
          </Button>
        </div>

        {schemaBlockMessage && (
          <div className="rounded-xl border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.1)] px-4 py-3 text-sm text-destructive">
            <p className="font-semibold">Datenbank-Schema unvollständig</p>
            <p className="mt-1 text-[rgba(239,68,68,0.9)]">{schemaBlockMessage}</p>
          </div>
        )}

        {loading && categories.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="min-w-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Kategorien</CardTitle>
                <p className="text-xs font-normal text-muted-foreground leading-relaxed">
                  Reihenfolge per ⋮⋮-Griff ändern (wird sofort gespeichert). Wähle eine Kategorie, um deren
                  Fachbereiche darunter zu bearbeiten.
                </p>
              </CardHeader>
              <CardContent className="flex max-h-[min(55vh,28rem)] flex-col gap-1 overflow-y-auto pr-1">
                {categories.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground py-6 text-center px-2">
                    {schemaBlockMessage
                      ? "Nach der Migration erscheinen hier die Kategorien."
                      : "Noch keine Kategorien — „Neue Kategorie“ anlegen."}
                  </p>
                )}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                  <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-1">
                      {categories.map((c) => (
                        <SortableCategoryRow
                          key={c.id}
                          category={c}
                          isSelected={selectedId === c.id}
                          onSelect={() => setSelectedId(c.id)}
                          onEdit={(e) => {
                            e.stopPropagation()
                            setFormEdit({ ...c })
                            setEditOpen(true)
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-[rgba(6,78,59,0.15)] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Fachbereiche{selected ? <span className="font-normal text-muted-foreground"> — {selected.name}</span> : null}
                </CardTitle>
                {selected ? (
                  <p className="text-xs font-normal text-muted-foreground leading-relaxed">
                    Reihenfolge per ⋮⋮-Griff ändern (wird sofort gespeichert).
                  </p>
                ) : (
                  <p className="text-xs font-normal text-muted-foreground">
                    Wähle oben eine Kategorie aus der Liste.
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {!selected ? (
                  <p className="rounded-lg border border-dashed border-[rgba(231,229,227,0.8)] bg-[rgba(245,245,244,0.3)] px-4 py-8 text-center text-sm text-muted-foreground">
                    Noch keine Kategorie gewählt — tippe auf eine Zeile unter „Kategorien“.
                  </p>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
                      <Input
                        placeholder="Neuer Fachbereich…"
                        value={newSpecName}
                        onChange={(e) => setNewSpecName(e.target.value)}
                        className="h-9 min-w-0 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            void addSpecialty()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full shrink-0 sm:w-auto sm:min-w-[7rem]"
                        onClick={addSpecialty}
                        disabled={saving}
                      >
                        Hinzufügen
                      </Button>
                    </div>
                    <DndContext
                      key={selected.id}
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleSpecialtyDragEnd}
                    >
                      <SortableContext
                        items={selected.specialties.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="flex max-h-[min(45vh,24rem)] flex-col gap-2 overflow-y-auto pr-1">
                          {selected.specialties.map((s) => (
                            <SortableSpecialtyRow
                              key={s.id}
                              specialty={s}
                              onNameChange={(id, name) => {
                                setCategories((prev) =>
                                  prev.map((c) =>
                                    c.id !== selected.id
                                      ? c
                                      : {
                                          ...c,
                                          specialties: c.specialties.map((x) =>
                                            x.id === id ? { ...x, name } : x,
                                          ),
                                        },
                                  ),
                                )
                              }}
                              onNameBlur={(id, name) => void patchSpecialty(id, { name })}
                              onToggleActive={(id, v) => void patchSpecialty(id, { isActive: v })}
                              onDelete={deleteSpecialty}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
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
                    <Image
                      src={formEdit.iconImageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 rounded border object-contain"
                      unoptimized
                    />
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

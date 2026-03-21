"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react"

type Item = {
  id: string
  title: string
  body: string
  linkUrl: string | null
  linkLabel: string | null
  published: boolean
  sortOrder: number
  publishedAt: string | null
}

export default function AdminHomeNewsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: "",
    body: "",
    linkUrl: "",
    linkLabel: "",
    published: false,
    sortOrder: 0,
  })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/home-news")
      if (res.status === 403) {
        router.replace("/home")
        return
      }
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return
    if ((session?.user as { role?: string })?.role !== "admin") {
      router.replace("/home")
      return
    }
    void load()
  }, [status, session, load, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Titel und Text ausfüllen.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/home-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          linkUrl: form.linkUrl.trim() || undefined,
          linkLabel: form.linkLabel.trim() || undefined,
          published: form.published,
          sortOrder: form.sortOrder,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Fehler")
        return
      }
      toast.success("News angelegt.")
      setForm({ title: "", body: "", linkUrl: "", linkLabel: "", published: false, sortOrder: 0 })
      void load()
    } finally {
      setCreating(false)
    }
  }

  async function patchItem(id: string, patch: Record<string, unknown>) {
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/home-news/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen")
        return
      }
      toast.success("Gespeichert.")
      void load()
    } finally {
      setSavingId(null)
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Diesen News-Eintrag wirklich löschen?")) return
    const res = await fetch(`/api/admin/home-news/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Gelöscht.")
      void load()
    } else toast.error("Löschen fehlgeschlagen")
  }

  if (status === "loading" || loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6 max-w-2xl mx-auto pb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/admin" aria-label="Zurück">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Startseiten-News</h1>
            <p className="text-xs text-muted-foreground">
              Redaktionelle Meldungen für den Newsfeed auf der Home-Seite (nur veröffentlichte Einträge sind sichtbar).
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="size-4" /> Neuer Eintrag
            </h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <Label className="text-xs">Titel</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 h-9"
                  placeholder="Kurze Überschrift"
                />
              </div>
              <div>
                <Label className="text-xs">Text</Label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Inhalt (mehrzeilig möglich)"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Link (optional)</Label>
                  <Input
                    value={form.linkUrl}
                    onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                    className="mt-1 h-9"
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <Label className="text-xs">Link-Text</Label>
                  <Input
                    value={form.linkLabel}
                    onChange={(e) => setForm((f) => ({ ...f, linkLabel: e.target.value }))}
                    className="mt-1 h-9"
                    placeholder="Mehr erfahren"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Sortierung</Label>
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="pub-new"
                    checked={form.published}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))}
                  />
                  <Label htmlFor="pub-new" className="text-xs cursor-pointer">
                    Veröffentlicht
                  </Label>
                </div>
                <Button type="submit" size="sm" disabled={creating} className="ml-auto">
                  {creating ? <Loader2 className="size-4 animate-spin" /> : "Anlegen"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Bestehende Einträge</h2>
          {items.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>}
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-muted-foreground font-mono truncate">{item.id.slice(0, 8)}…</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => deleteItem(item.id)}
                    aria-label="Löschen"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div>
                  <Label className="text-xs">Titel</Label>
                  <Input
                    className="mt-1 h-9"
                    defaultValue={item.title}
                    key={`t-${item.id}-${item.updatedAt}`}
                    onBlur={(e) => {
                      if (e.target.value !== item.title) patchItem(item.id, { title: e.target.value })
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Text</Label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={3}
                    defaultValue={item.body}
                    key={`b-${item.id}-${item.updatedAt}`}
                    onBlur={(e) => {
                      if (e.target.value !== item.body) patchItem(item.id, { body: e.target.value })
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Link</Label>
                    <Input
                      className="mt-1 h-9"
                      defaultValue={item.linkUrl ?? ""}
                      key={`u-${item.id}-${item.updatedAt}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        const next = v || null
                        if (next !== (item.linkUrl ?? null)) patchItem(item.id, { linkUrl: next })
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Link-Text</Label>
                    <Input
                      className="mt-1 h-9"
                      defaultValue={item.linkLabel ?? ""}
                      key={`l-${item.id}-${item.updatedAt}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        const next = v || null
                        if (next !== (item.linkLabel ?? null)) patchItem(item.id, { linkLabel: next })
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Sortierung</Label>
                    <Input
                      type="number"
                      className="h-8 w-20"
                      defaultValue={item.sortOrder}
                      key={`s-${item.id}-${item.updatedAt}`}
                      onBlur={(e) => {
                        const n = Number(e.target.value)
                        if (!Number.isNaN(n) && n !== item.sortOrder) patchItem(item.id, { sortOrder: n })
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`pub-${item.id}`}
                      checked={item.published}
                      disabled={savingId === item.id}
                      onCheckedChange={(v) => patchItem(item.id, { published: v })}
                    />
                    <Label htmlFor={`pub-${item.id}`} className="text-xs cursor-pointer">
                      Veröffentlicht
                    </Label>
                  </div>
                  {savingId === item.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { HOME_NEWS_LOCALES, type HomeNewsLocale } from "@/lib/home-news-locales"
import { localeNames } from "@/lib/i18n"

type TranslationsMap = Partial<
  Record<HomeNewsLocale, { title: string; body: string; linkUrl?: string | null; linkLabel?: string | null }>
>

type Item = {
  id: string
  linkUrl: string | null
  linkLabel: string | null
  published: boolean
  sortOrder: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  translations: TranslationsMap
}

type LocaleFormRow = { title: string; body: string; linkUrl: string; linkLabel: string }

const emptyTranslations = (): Record<HomeNewsLocale, LocaleFormRow> => ({
  de: { title: "", body: "", linkUrl: "", linkLabel: "" },
  en: { title: "", body: "", linkUrl: "", linkLabel: "" },
  es: { title: "", body: "", linkUrl: "", linkLabel: "" },
})

function hasAtLeastOneTranslation(tr: Record<HomeNewsLocale, LocaleFormRow>) {
  return HOME_NEWS_LOCALES.some((loc) => tr[loc].title.trim() && tr[loc].body.trim())
}

function mapItemToLocaleState(item: Item): Record<HomeNewsLocale, LocaleFormRow> {
  return {
    de: {
      title: item.translations.de?.title ?? "",
      body: item.translations.de?.body ?? "",
      linkUrl: item.translations.de?.linkUrl ?? "",
      linkLabel: item.translations.de?.linkLabel ?? "",
    },
    en: {
      title: item.translations.en?.title ?? "",
      body: item.translations.en?.body ?? "",
      linkUrl: item.translations.en?.linkUrl ?? "",
      linkLabel: item.translations.en?.linkLabel ?? "",
    },
    es: {
      title: item.translations.es?.title ?? "",
      body: item.translations.es?.body ?? "",
      linkUrl: item.translations.es?.linkUrl ?? "",
      linkLabel: item.translations.es?.linkLabel ?? "",
    },
  }
}

/** Bestehender Eintrag: kontrollierte Felder + ein Speichern-Button (kein onBlur beim Tab-Wechsel). */
function AdminHomeNewsExistingCard({
  item,
  disabled,
  onSave,
  onDelete,
}: {
  item: Item
  disabled: boolean
  onSave: (id: string, payload: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => void
}) {
  const [loc, setLoc] = useState(() => mapItemToLocaleState(item))
  const [fallbackUrl, setFallbackUrl] = useState(item.linkUrl ?? "")
  const [fallbackLabel, setFallbackLabel] = useState(item.linkLabel ?? "")
  const [sortOrder, setSortOrder] = useState(item.sortOrder)
  const [published, setPublished] = useState(item.published)

  useEffect(() => {
    setLoc(mapItemToLocaleState(item))
    setFallbackUrl(item.linkUrl ?? "")
    setFallbackLabel(item.linkLabel ?? "")
    setSortOrder(item.sortOrder)
    setPublished(item.published)
  }, [item])

  async function handleSave() {
    const translations: Record<
      string,
      { title: string; body: string; linkUrl: string | null; linkLabel: string | null }
    > = {}
    for (const l of HOME_NEWS_LOCALES) {
      const b = loc[l]
      translations[l] = {
        title: b.title.trim(),
        body: b.body.trim(),
        linkUrl: b.linkUrl.trim() || null,
        linkLabel: b.linkLabel.trim() || null,
      }
    }
    await onSave(item.id, {
      translations,
      linkUrl: fallbackUrl.trim() || null,
      linkLabel: fallbackLabel.trim() || null,
      sortOrder,
      published,
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex justify-between gap-2">
          <span className="truncate font-mono text-xs text-muted-foreground">{item.id.slice(0, 8)}…</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={disabled}
            aria-label="Löschen"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <Tabs defaultValue="de" className="w-full">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            {HOME_NEWS_LOCALES.map((l) => (
              <TabsTrigger key={l} value={l} className="text-xs">
                {localeNames[l]}
              </TabsTrigger>
            ))}
          </TabsList>
          {HOME_NEWS_LOCALES.map((l) => (
            <TabsContent key={l} value={l} className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Titel ({localeNames[l]})</Label>
                <Input
                  className="mt-1 h-9"
                  value={loc[l].title}
                  disabled={disabled}
                  onChange={(e) => setLoc((p) => ({ ...p, [l]: { ...p[l], title: e.target.value } }))}
                />
              </div>
              <div>
                <Label className="text-xs">Text</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={4}
                  value={loc[l].body}
                  disabled={disabled}
                  onChange={(e) => setLoc((p) => ({ ...p, [l]: { ...p[l], body: e.target.value } }))}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Link (nur diese Sprache)</Label>
                  <Input
                    className="mt-1 h-9 font-mono text-xs"
                    value={loc[l].linkUrl}
                    disabled={disabled}
                    placeholder="/pfad oder https://…"
                    onChange={(e) => setLoc((p) => ({ ...p, [l]: { ...p[l], linkUrl: e.target.value } }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Link-Text</Label>
                  <Input
                    className="mt-1 h-9"
                    value={loc[l].linkLabel}
                    disabled={disabled}
                    placeholder="z. B. Mehr erfahren"
                    onChange={(e) => setLoc((p) => ({ ...p, [l]: { ...p[l], linkLabel: e.target.value } }))}
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <p className="text-[10px] text-muted-foreground">
          Titel + Text für eine Sprache leer lassen und speichern → diese Sprachfassung wird entfernt.
        </p>

        <div className="space-y-3 rounded-xl border border-[rgba(231,229,227,0.6)] bg-[rgba(245,245,244,0.3)] p-3">
          <p className="text-xs font-medium text-muted-foreground">Fallback (wenn eine Sprache keinen Link hat)</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Fallback-Link</Label>
              <Input
                className="mt-1 h-9 font-mono text-xs"
                value={fallbackUrl}
                disabled={disabled}
                onChange={(e) => setFallbackUrl(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Fallback Link-Text</Label>
              <Input
                className="mt-1 h-9"
                value={fallbackLabel}
                disabled={disabled}
                onChange={(e) => setFallbackLabel(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Sortierung</Label>
              <Input
                type="number"
                className="h-8 w-20"
                value={sortOrder}
                disabled={disabled}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`pub-${item.id}`}
                checked={published}
                disabled={disabled}
                onCheckedChange={setPublished}
              />
              <Label htmlFor={`pub-${item.id}`} className="cursor-pointer text-xs">
                Veröffentlicht
              </Label>
            </div>
            <Button type="button" size="sm" className="ml-auto" disabled={disabled} onClick={() => void handleSave()}>
              {disabled ? <Loader2 className="size-4 animate-spin" /> : "Speichern"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminHomeNewsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const [formTr, setFormTr] = useState(emptyTranslations)
  const [form, setForm] = useState({
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
    if (!hasAtLeastOneTranslation(formTr)) {
      toast.error("Mindestens eine Sprache mit Titel und Text ausfüllen.")
      return
    }
    setCreating(true)
    try {
      const translations: Record<
        string,
        { title: string; body: string; linkUrl?: string | null; linkLabel?: string | null }
      > = {}
      for (const loc of HOME_NEWS_LOCALES) {
        const title = formTr[loc].title.trim()
        const body = formTr[loc].body.trim()
        if (title && body) {
          translations[loc] = {
            title,
            body,
            linkUrl: formTr[loc].linkUrl.trim() || null,
            linkLabel: formTr[loc].linkLabel.trim() || null,
          }
        }
      }
      const res = await fetch("/api/admin/home-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          translations,
          linkUrl: form.linkUrl.trim() || null,
          linkLabel: form.linkLabel.trim() || null,
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
      setFormTr(emptyTranslations())
      setForm({ linkUrl: "", linkLabel: "", published: false, sortOrder: 0 })
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
              Redaktionelle Meldungen pro Sprache (DE / EN / ES). Im Feed sieht jede UI-Sprache die passende Fassung,
              sonst Fallback (z. B. Deutsch).
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="size-4" /> Neuer Eintrag
            </h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <Tabs defaultValue="de" className="w-full">
                <TabsList className="w-full justify-start">
                  {HOME_NEWS_LOCALES.map((loc) => (
                    <TabsTrigger key={loc} value={loc} className="text-xs">
                      {localeNames[loc]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {HOME_NEWS_LOCALES.map((loc) => (
                  <TabsContent key={loc} value={loc} className="space-y-2">
                    <div>
                      <Label className="text-xs">Titel</Label>
                      <Input
                        className="mt-1 h-9"
                        value={formTr[loc].title}
                        onChange={(e) =>
                          setFormTr((prev) => ({ ...prev, [loc]: { ...prev[loc], title: e.target.value } }))
                        }
                        placeholder="Überschrift"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Text</Label>
                      <textarea
                        value={formTr[loc].body}
                        onChange={(e) =>
                          setFormTr((prev) => ({ ...prev, [loc]: { ...prev[loc], body: e.target.value } }))
                        }
                        rows={4}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Inhalt"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Link (nur diese Sprache)</Label>
                        <Input
                          className="mt-1 h-9 font-mono text-xs"
                          value={formTr[loc].linkUrl}
                          onChange={(e) =>
                            setFormTr((prev) => ({ ...prev, [loc]: { ...prev[loc], linkUrl: e.target.value } }))
                          }
                          placeholder="/pfad oder https://…"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Link-Text</Label>
                        <Input
                          className="mt-1 h-9"
                          value={formTr[loc].linkLabel}
                          onChange={(e) =>
                            setFormTr((prev) => ({ ...prev, [loc]: { ...prev[loc], linkLabel: e.target.value } }))
                          }
                          placeholder="Mehr erfahren"
                        />
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Fallback-Link (optional)</Label>
                  <Input
                    value={form.linkUrl}
                    onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                    className="mt-1 h-9 font-mono text-xs"
                    placeholder="wenn eine Sprache keinen Link hat"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fallback Link-Text</Label>
                  <Input
                    value={form.linkLabel}
                    onChange={(e) => setForm((f) => ({ ...f, linkLabel: e.target.value }))}
                    className="mt-1 h-9"
                    placeholder="z. B. Mehr erfahren"
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
            <AdminHomeNewsExistingCard
              key={item.id}
              item={item}
              disabled={savingId === item.id}
              onSave={(id, payload) => patchItem(id, payload)}
              onDelete={deleteItem}
            />
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

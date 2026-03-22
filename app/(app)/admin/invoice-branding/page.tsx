"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  DOC_TEMPLATE_FIELDS_BY_KEY,
  DOC_TEMPLATE_FIELD_LABELS,
  DOC_TEMPLATE_FIELD_ORDER,
  DOC_TYPE_LABELS,
  getInvoiceDocTemplateDefaults,
  INVOICE_DOC_KEYS,
  type InvoiceDocKey,
  type InvoiceDocTemplatePatch,
} from "@/lib/invoice-doc-templates"
import { toast } from "sonner"
import { ArrowLeft, Eye, Loader2, Palette, Save, Upload } from "lucide-react"

type BrandingPayload = {
  logoUrl: string | null
  accentHex: string
  footerText: string | null
  paymentNote: string | null
  closingLine: string | null
}

function emptyTemplateRow(): Record<keyof InvoiceDocTemplatePatch, string> {
  const r = {} as Record<keyof InvoiceDocTemplatePatch, string>
  for (const k of DOC_TEMPLATE_FIELD_ORDER) {
    r[k] = ""
  }
  return r
}

function initialDocTemplatesState(): Record<InvoiceDocKey, Record<keyof InvoiceDocTemplatePatch, string>> {
  const init = {} as Record<InvoiceDocKey, Record<keyof InvoiceDocTemplatePatch, string>>
  for (const k of INVOICE_DOC_KEYS) {
    init[k] = emptyTemplateRow()
  }
  return init
}

export default function AdminInvoiceBrandingPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<BrandingPayload>({
    logoUrl: null,
    accentHex: "#064e3b",
    footerText: null,
    paymentNote: null,
    closingLine: null,
  })
  const [docTemplates, setDocTemplates] = useState(initialDocTemplatesState)
  const [activeDocTab, setActiveDocTab] = useState<InvoiceDocKey>("re_session")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/admin/invoice-branding", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          data.error ??
          (res.status === 500
            ? "Serverfehler – oft fehlt die DB-Migration (Tabelle InvoiceBranding)."
            : "Laden fehlgeschlagen.")
        setLoadError(msg)
        toast.error(msg)
        return
      }
      setForm({
        logoUrl: data.logoUrl ?? null,
        accentHex: data.accentHex ?? "#064e3b",
        footerText: data.footerText ?? null,
        paymentNote: data.paymentNote ?? null,
        closingLine: data.closingLine ?? null,
      })

      const dt = (data.documentTemplates ?? {}) as Record<string, unknown>
      const next = initialDocTemplatesState()
      for (const k of INVOICE_DOC_KEYS) {
        const patch = dt[k]
        const row = emptyTemplateRow()
        if (patch && typeof patch === "object" && !Array.isArray(patch)) {
          const p = patch as Record<string, unknown>
          for (const fk of DOC_TEMPLATE_FIELD_ORDER) {
            const v = p[fk as string]
            row[fk] = typeof v === "string" ? v : ""
          }
        }
        next[k] = row
      }
      setDocTemplates(next)
    } catch {
      const msg =
        "Netzwerkfehler. Ohne Verbindung zur API oder Datenbank (z. B. offline, falsche URL) können die Einstellungen nicht geladen werden."
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function buildDocumentTemplatesPayload(): Record<string, InvoiceDocTemplatePatch> {
    const out: Record<string, InvoiceDocTemplatePatch> = {}
    for (const k of INVOICE_DOC_KEYS) {
      const patch: InvoiceDocTemplatePatch = {}
      const row = docTemplates[k]
      for (const fk of DOC_TEMPLATE_FIELD_ORDER) {
        const v = row[fk]?.trim()
        if (v) patch[fk] = v
      }
      if (Object.keys(patch).length > 0) {
        out[k] = patch
      }
    }
    return out
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/invoice-branding/logo", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Upload fehlgeschlagen.")
        return
      }
      setForm((p) => ({ ...p, logoUrl: data.url }))
      toast.success("Logo hochgeladen. Bitte speichern.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/invoice-branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: form.logoUrl,
          accentHex: form.accentHex,
          footerText: form.footerText || null,
          paymentNote: form.paymentNote || null,
          closingLine: form.closingLine || null,
          documentTemplates: buildDocumentTemplatesPayload(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen.")
        return
      }
      toast.success("Rechnungs-PDF-Einstellungen gespeichert. Gilt für neu erzeugte PDFs.")
    } finally {
      setSaving(false)
    }
  }

  function setDocField(key: InvoiceDocKey, field: keyof InvoiceDocTemplatePatch, value: string) {
    setDocTemplates((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  function placeholderFor(key: InvoiceDocKey, field: keyof InvoiceDocTemplatePatch): string {
    const d = getInvoiceDocTemplateDefaults(key)[field]
    if (typeof d === "string" && d !== "") {
      return `Standard: ${d}`
    }
    if (field === "paymentNote" && (key === "re_session" || key === "re_wallet")) {
      const g = form.paymentNote?.trim()
      if (g) return `Aus global: ${g}`
    }
    if (field === "closingLine") {
      const g = form.closingLine?.trim()
      if (g) return `Aus global: ${g}`
    }
    if (field === "footerText") {
      const g = form.footerText?.trim()
      if (g) return `Aus global: ${g}`
    }
    return "Leer = Standard / globaler Text"
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageContainer>
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/finance">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Rechnungs-PDF</h1>
              <p className="text-xs text-muted-foreground">
                Logo, Akzentfarbe, globale Texte und pro Belegtyp anpassbare PDF-Texte (jsPDF). Nur für{" "}
                <strong>neu erzeugte</strong> Dateien. Lokal: Migration (
                <code className="rounded bg-muted px-1">npm run db:migrate</code>
                ). Logo-Upload braucht Internet (Vercel Blob).
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Einstellungen nicht geladen</CardTitle>
                <CardDescription>{loadError}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Häufige Ursachen:</strong> Tabelle fehlt →{" "}
                  <code className="rounded bg-muted px-1">npm run db:migrate</code> im Projektordner. Ohne
                  erreichbare Datenbank (z. B. Cloud-DB offline) schlägt die API fehl.
                </p>
                <Button variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
                  Erneut laden
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Darstellung &amp; globale Texte</CardTitle>
                  <CardDescription>
                    Absender (Name, Adresse, USt-ID) kommt aus der technischen Konfiguration. Zahlungshinweis,
                    Abschlusszeile und Fußtext gelten als Standard für alle Belege, sofern unten pro Beleg nicht
                    überschrieben.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <div className="space-y-2">
                    <Label>Logo (rechts oben im PDF)</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      {form.logoUrl ? (
                        <div className="flex h-14 w-40 items-center justify-center overflow-hidden rounded border bg-muted p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element -- Blob-URL, offline-freundlicher als next/image */}
                          <img src={form.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Kein Logo</span>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => void handleLogoUpload(e)}
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        Hochladen
                      </Button>
                      {form.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setForm((p) => ({ ...p, logoUrl: null }))}
                        >
                          Logo entfernen
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accentHex" className="flex items-center gap-2">
                      <Palette className="size-4" />
                      Akzentfarbe (Titel &amp; Linie)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="accentHex"
                        value={form.accentHex}
                        onChange={(e) => setForm((p) => ({ ...p, accentHex: e.target.value }))}
                        placeholder="#064e3b"
                        className="font-mono"
                      />
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/i.test(form.accentHex) ? form.accentHex : "#064e3b"}
                        onChange={(e) => setForm((p) => ({ ...p, accentHex: e.target.value }))}
                        className="h-10 w-14 cursor-pointer rounded border"
                        aria-label="Farbe wählen"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentNote">Zahlungshinweis (Standard für RE / Wallet-RE)</Label>
                    <Textarea
                      id="paymentNote"
                      value={form.paymentNote ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, paymentNote: e.target.value || null }))}
                      rows={2}
                      placeholder="Leer = eingebauter Standardtext"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="closingLine">Abschlusszeile (Standard unten, je Beleg überschreibbar)</Label>
                    <Textarea
                      id="closingLine"
                      value={form.closingLine ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, closingLine: e.target.value || null }))}
                      rows={2}
                      placeholder="Leer = Standard je Belegtyp"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="footerText">Zusätzlicher Fußtext (global, mehrzeilig)</Label>
                    <Textarea
                      id="footerText"
                      value={form.footerText ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, footerText: e.target.value || null }))}
                      rows={3}
                      placeholder="Optional, erscheint über der Abschlusszeile"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Texte pro Belegtyp</CardTitle>
                  <CardDescription>
                    Leere Felder = Standard aus Code bzw. globale Texte (siehe Platzhalter). Nach Änderungen bitte{" "}
                    <strong>Speichern</strong>; die Vorschau zeigt das zuletzt gespeicherte Branding.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Tabs value={activeDocTab} onValueChange={(v) => setActiveDocTab(v as InvoiceDocKey)}>
                    <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                      {INVOICE_DOC_KEYS.map((k) => (
                        <TabsTrigger key={k} value={k} className="text-xs sm:text-sm">
                          {DOC_TYPE_LABELS[k]}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {INVOICE_DOC_KEYS.map((docKey) => (
                      <TabsContent key={docKey} value={docKey} className="mt-4 flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="secondary" type="button" className="gap-2" asChild>
                            <a
                              href={`/api/admin/invoice-branding/preview?doc=${docKey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="size-4" />
                              PDF-Vorschau ({DOC_TYPE_LABELS[docKey]})
                            </a>
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-1">
                          {DOC_TEMPLATE_FIELDS_BY_KEY[docKey].map((field) => (
                            <div key={field} className="space-y-1.5">
                              <Label htmlFor={`${docKey}-${field}`} className="text-sm">
                                {DOC_TEMPLATE_FIELD_LABELS[field]}
                              </Label>
                              <Textarea
                                id={`${docKey}-${field}`}
                                value={docTemplates[docKey][field]}
                                onChange={(e) => setDocField(docKey, field, e.target.value)}
                                rows={field === "footerText" || field === "paymentNote" ? 3 : 2}
                                placeholder={placeholderFor(docKey, field)}
                                className="font-mono text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-2 pb-8">
                <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Alles speichern
                </Button>
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </div>
  )
}

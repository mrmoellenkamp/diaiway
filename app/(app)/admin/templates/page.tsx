"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Loader2, Mail, Send, FileText } from "lucide-react"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"

interface TemplateTranslation {
  id: string
  templateId: string
  language: string
  subject: string | null
  body: string
}

interface Template {
  id: string
  slug: string
  category: string
  availableVariables: unknown
  translations: TemplateTranslation[]
}

const LANGUAGES = ["de", "en", "es"] as const
const STANDARD_VARS = ["{{sender_name}}", "{{recipient_name}}", "{{sender_role}}", "{{recipient_role}}"]
const BOOKING_VARS = ["{{booking_date}}", "{{service_name}}", "{{booking_time}}", "{{booking_note}}"]
const GUEST_CALL_VARS = ["{{takumi_name}}", "{{guest_email}}", "{{date}}", "{{start_time}}", "{{end_time}}", "{{price}}", "{{call_link}}", "{{host_message}}"]
const GUEST_CALL_SLUGS = ["guest-call-invite", "guest-call-confirm-takumi"]

export default function AdminTemplatesPage() {
  const { t } = useI18n()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [seedLoading, setSeedLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testUserId, setTestUserId] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [edits, setEdits] = useState<Record<string, Record<string, { subject?: string; body?: string }>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/templates")
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch {
      toast.error(t("toast.loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  function getEdit(templateId: string, lang: string, field: "subject" | "body") {
    return edits[templateId]?.[lang]?.[field] ?? null
  }

  function setEdit(templateId: string, lang: string, field: "subject" | "body", value: string) {
    setEdits((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [lang]: {
          ...prev[templateId]?.[lang],
          [field]: value,
        },
      },
    }))
  }

  function getDisplayValue(t: Template, lang: string, field: "subject" | "body") {
    const edit = getEdit(t.id, lang, field)
    if (edit !== null && edit !== undefined) return edit
    const tr = t.translations.find((x) => x.language === lang)
    return field === "subject" ? (tr?.subject ?? "") : (tr?.body ?? "")
  }

  async function handleSave(template: Template, language: string) {
    const templateId = template.id
    setSavingId(`${templateId}-${language}`)
    try {
      const subject = getDisplayValue(template, language, "subject")
      const body = getDisplayValue(template, language, "body")
      const payload = { language, subject, body }

      const res = await fetch(`/api/admin/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success(t("toast.saved"))
        setEdits((prev) => {
          const next = { ...prev }
          if (next[templateId]?.[language]) {
            next[templateId] = { ...next[templateId] }
            delete next[templateId][language]
          }
          return next
        })
        void load()
      } else {
        toast.error(t("toast.saveError"))
      }
    } finally {
      setSavingId(null)
    }
  }

  async function handleSeed() {
    setSeedLoading(true)
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message ?? "Templates ges seeded")
        void load()
      } else {
        toast.error(data.error ?? "Fehler")
      }
    } finally {
      setSeedLoading(false)
    }
  }

  const isGuestCallSlug = (slug: string) => GUEST_CALL_SLUGS.includes(slug)

  async function handleTest(slug: string, language: string) {
    const isGuest = isGuestCallSlug(slug)
    if (isGuest && !testEmail.trim()) {
      toast.error("Bitte Test-E-Mail-Adresse eingeben (für Gast-Call-Templates).")
      return
    }
    if (!isGuest && !testUserId.trim()) {
      toast.error(t("toast.enterUserId"))
      return
    }
    setTestLoading(true)
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          slug,
          language,
          ...(isGuest ? { testEmail: testEmail.trim() } : { recipientUserId: testUserId.trim() }),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.mode === "email") {
          toast.success(`Test-E-Mail gesendet an ${data.sentTo}`)
        } else {
          toast.success(`Test-Waymail gesendet (ID: ${data.waymailId})`)
        }
      } else {
        toast.error(data.error ?? "Fehler")
      }
    } finally {
      setTestLoading(false)
    }
  }

  const varsForTemplate = (slug: string, cat: string) => {
    if (GUEST_CALL_SLUGS.includes(slug)) return GUEST_CALL_VARS
    return cat === "BOOKING" ? [...STANDARD_VARS, ...BOOKING_VARS] : STANDARD_VARS
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeed}
            disabled={seedLoading}
          >
            {seedLoading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
            Templates seeden
          </Button>
        </div>

        <h1 className="text-xl font-bold">Kommunikations-Templates</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="mx-auto mb-3 size-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">Keine Templates. Klicke auf „Templates seeden“.</p>
              <Button onClick={handleSeed} disabled={seedLoading}>
                {seedLoading ? <Loader2 className="size-4 animate-spin" /> : "Templates seeden"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Test-Empfänger */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Test senden</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">
                      Empfänger User-ID <span className="font-normal text-muted-foreground">(Standard-Templates &rarr; Waymail)</span>
                    </Label>
                    <Input
                      placeholder="User-ID (z.B. eigene)"
                      value={testUserId}
                      onChange={(e) => setTestUserId(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      Test-E-Mail <span className="font-normal text-muted-foreground">(Gast-Call-Templates &rarr; echte E-Mail)</span>
                    </Label>
                    <Input
                      type="email"
                      placeholder="test@beispiel.de"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gast-Call-Templates (<code className="rounded bg-muted px-1 py-0.5 text-[11px]">guest-call-*</code>) senden eine echte E-Mail, alle anderen eine Waymail.
                </p>
              </CardContent>
            </Card>

            {templates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="size-4" />
                    {t.slug}
                    <span className="text-xs font-normal text-muted-foreground">({t.category})</span>
                  </CardTitle>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {varsForTemplate(t.slug, t.category).map((v) => (
                      <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {v}
                      </code>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="de">
                    <TabsList>
                      {LANGUAGES.map((lang) => (
                        <TabsTrigger key={lang} value={lang}>
                          {lang.toUpperCase()}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {LANGUAGES.map((lang) => (
                      <TabsContent key={lang} value={lang} className="mt-4 space-y-4">
                        <div>
                          <Label className="text-xs">Betreff</Label>
                          <Input
                            value={getDisplayValue(t, lang, "subject")}
                            onChange={(e) => setEdit(t.id, lang, "subject", e.target.value)}
                            placeholder="Betreff"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Inhalt (Body)</Label>
                          <textarea
                            value={getDisplayValue(t, lang, "body")}
                            onChange={(e) => setEdit(t.id, lang, "body", e.target.value)}
                            placeholder="Inhalt mit {{variablen}}"
                            className="mt-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            rows={6}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(t, lang)}
                            disabled={savingId === `${t.id}-${lang}`}
                          >
                            {savingId === `${t.id}-${lang}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Speichern"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTest(t.slug, lang)}
                            disabled={testLoading || !testUserId.trim()}
                          >
                            {testLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            Test senden
                          </Button>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

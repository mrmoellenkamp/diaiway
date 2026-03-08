"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageUpload } from "@/components/image-upload"
import { TakumiPortfolioGallery, type TakumiPortfolioProject } from "@/components/takumi-portfolio-gallery"
import { PageContainer } from "@/components/page-container"
import { toast } from "sonner"
import { ArrowLeft, Plus, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { categories } from "@/lib/categories"

export default function TakumiPortfolioPage() {
  const { t } = useI18n()
  const [projects, setProjects] = useState<TakumiPortfolioProject[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    category: "",
    completionDate: "",
  })

  useEffect(() => {
    fetch("/api/takumi/portfolio")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.projects)) setProjects(data.projects)
      })
      .catch(() => toast.error(t("portfolio.loadError")))
      .finally(() => setLoading(false))
  }, [t])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title || title.length < 2) {
      toast.error(t("portfolio.titleMinLength"))
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/takumi/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: form.description.trim(),
          imageUrl: form.imageUrl || "",
          category: form.category.trim(),
          completionDate: form.completionDate || null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || t("portfolio.saveError"))
        return
      }

      setProjects((prev) => [data.project, ...prev])
      setForm({ title: "", description: "", imageUrl: "", category: "", completionDate: "" })
      setShowForm(false)
      toast.success(t("portfolio.projectAdded"))
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("portfolio.deleteConfirm"))) return
    try {
      const res = await fetch(`/api/takumi/portfolio/${id}`, { method: "DELETE" })
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id))
        toast.success(t("portfolio.projectDeleted"))
      } else {
        const data = await res.json()
        toast.error(data.error)
      }
    } catch {
      toast.error(t("common.networkError"))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageContainer>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link href="/profile">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">{t("portfolio.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("portfolio.subtitle")}</p>
            </div>
          </div>

          {/* Galerie */}
          <TakumiPortfolioGallery
            projects={projects}
            readOnly={false}
            title={t("portfolio.masterpieces")}
            emptyMessage={t("portfolio.empty")}
            onDelete={handleDelete}
          />

          {/* Add-Formular */}
          {showForm ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("portfolio.addProject")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {t("portfolio.formTitle")} *
                    </label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={t("portfolio.formTitlePlaceholder")}
                      className="h-10"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {t("portfolio.formDescription")}
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder={t("portfolio.formDescriptionPlaceholder")}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {t("portfolio.formImage")}
                    </label>
                    <ImageUpload
                      value={form.imageUrl}
                      onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                      folder="takumi-portfolio"
                      variant="card"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {t("portfolio.formCategory")}
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">{t("portfolio.formCategoryPlaceholder")}</option>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      {t("portfolio.formCompletionDate")}
                    </label>
                    <Input
                      type="date"
                      value={form.completionDate}
                      onChange={(e) => setForm((f) => ({ ...f, completionDate: e.target.value }))}
                      className="h-10"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="flex-1 gap-2"
                    >
                      {saving ? (
                        <><Loader2 className="size-4 animate-spin" /> {t("common.saving")}</>
                      ) : (
                        <><Plus className="size-4" /> {t("portfolio.saveProject")}</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed"
              onClick={() => setShowForm(true)}
            >
              <Plus className="size-4" /> {t("portfolio.addProject")}
            </Button>
          )}

        </div>
      </PageContainer>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/image-upload"
import { useI18n } from "@/lib/i18n"
import { Plus, Loader2, Trash2, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { AppSubpageHeader } from "@/components/app-subpage-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const SKILL_LEVELS = [
  { value: "NEULING", color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/40" },
  { value: "FORTGESCHRITTEN", color: "bg-blue-500/20 text-blue-700 border-blue-500/40" },
  { value: "PROFI", color: "bg-violet-500/20 text-violet-700 border-violet-500/40" },
] as const

type SkillLevel = (typeof SKILL_LEVELS)[number]["value"]

interface ShugyoProject {
  id: string
  title: string
  description: string
  imageUrl: string
}

export default function ShugyoDashboardPage() {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null)
  const [projects, setProjects] = useState<ShugyoProject[]>([])
  const [savingSkill, setSavingSkill] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newImageUrl, setNewImageUrl] = useState("")
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editImageUrl, setEditImageUrl] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, projectsRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/shugyo/projects"),
        ])
        if (profileRes.ok) {
          const p = await profileRes.json()
          setSkillLevel(p.skillLevel ?? null)
        }
        if (projectsRes.ok) {
          const { projects: projs } = await projectsRes.json()
          setProjects(projs ?? [])
        }
      } catch {
        toast.error(t("common.networkError"))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [t])

  async function handleSaveSkillLevel(level: SkillLevel) {
    setSavingSkill(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillLevel: level }),
      })
      if (res.ok) {
        setSkillLevel(level)
        toast.success(t("shugyo.skillSaved"))
      } else {
        const data = await res.json()
        toast.error(data.error || t("profile.error"))
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setSavingSkill(false)
    }
  }

  async function handleAddProject() {
    if (!newTitle.trim() || newTitle.trim().length < 2) {
      toast.error(t("shugyo.titleMinLength"))
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/shugyo/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          imageUrl: newImageUrl,
        }),
      })
      if (res.ok) {
        const { project } = await res.json()
        setProjects((prev) => [project, ...prev])
        setShowAddModal(false)
        setNewTitle("")
        setNewDescription("")
        setNewImageUrl("")
        toast.success(t("shugyo.projectAdded"))
      } else {
        const data = await res.json()
        toast.error(data.error || t("profile.error"))
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setAdding(false)
    }
  }

  async function handleUpdateProject() {
    if (!editingId || !editTitle.trim() || editTitle.trim().length < 2) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/shugyo/projects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          imageUrl: editImageUrl,
        }),
      })
      if (res.ok) {
        const { project } = await res.json()
        setProjects((prev) => prev.map((p) => (p.id === editingId ? project : p)))
        setEditingId(null)
        toast.success(t("shugyo.projectUpdated"))
      } else {
        const data = await res.json()
        toast.error(data.error || t("profile.error"))
      }
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteProject(id: string) {
    try {
      const res = await fetch(`/api/shugyo/projects/${id}`, { method: "DELETE" })
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id))
        if (editingId === id) setEditingId(null)
        toast.success(t("shugyo.projectDeleted"))
      } else {
        const data = await res.json()
        toast.error(data.error || t("profile.error"))
      }
    } catch {
      toast.error(t("common.networkError"))
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <AppSubpageHeader
          title={t("shugyo.dashboardTitle")}
          subtitle={t("shugyo.dashboardDesc")}
        />

        {/* Projects */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t("shugyo.myProjects")}</h2>
            <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1.5">
              <Plus className="size-4" />
              {t("shugyo.addProject")}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id} className="border-border/60 overflow-hidden">
                <CardContent className="p-0">
                  {editingId === p.id ? (
                    <div className="p-4 space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t("shugyo.projectTitle")}
                        className="h-9"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder={t("shugyo.projectDescription")}
                        rows={2}
                        className="resize-none text-sm"
                      />
                      <ImageUpload
                        value={editImageUrl}
                        onChange={setEditImageUrl}
                        folder="shugyo-projects"
                        variant="card"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateProject} disabled={savingEdit}>
                          {savingEdit ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative aspect-video w-full bg-muted/50">
                        {p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt={p.title}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <ImageIcon className="size-12 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-foreground line-clamp-1">{p.title}</h3>
                        {p.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditTitle(p.title)
                              setEditDescription(p.description)
                              setEditImageUrl(p.imageUrl)
                              setEditingId(p.id)
                            }}
                          >
                            {t("common.edit")}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("shugyo.deleteProjectConfirm")}</AlertDialogTitle>
                                <AlertDialogDescription>{t("shugyo.deleteProjectDesc")}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteProject(p.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  {t("common.delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {projects.length === 0 && (
            <Card className="border-dashed border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <ImageIcon className="size-12 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("shugyo.noProjects")}</p>
                <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                  {t("shugyo.addFirstProject")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Kenntnisstufe – unterhalb Projekte */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">{t("shugyo.selectSkillLevel")}</h2>
            <p className="text-xs text-muted-foreground mb-4">{t("shugyo.skillLevelDesc")}</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_LEVELS.map(({ value, color }) => (
                <button
                  key={value}
                  onClick={() => handleSaveSkillLevel(value)}
                  disabled={savingSkill}
                  className="focus:outline-none"
                >
                  <Badge
                    variant="outline"
                    className={`cursor-pointer transition-all ${
                      skillLevel === value ? color : "bg-muted/50 text-muted-foreground border-border"
                    } ${savingSkill ? "opacity-70" : ""}`}
                  >
                    {value === "NEULING"
                      ? t("shugyo.skillNeuling")
                      : value === "FORTGESCHRITTEN"
                        ? t("shugyo.skillFortgeschritten")
                        : t("shugyo.skillProfi")}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-foreground">{t("shugyo.addProject")}</h3>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("shugyo.projectTitle")}
              />
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder={t("shugyo.projectDescription")}
                rows={3}
                className="resize-none"
              />
              <ImageUpload
                value={newImageUrl}
                onChange={setNewImageUrl}
                folder="shugyo-projects"
                variant="card"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddProject} disabled={adding}>
                  {adding ? <Loader2 className="size-4 animate-spin" /> : t("common.add")}
                </Button>
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  )
}

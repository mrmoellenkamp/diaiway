"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react"

type Snippet = {
  id: string
  title: string
  body: string
  isActive: boolean
  sortOrder: number
}

type ExpertHit = {
  id: string
  userId: string | null
  name: string
  email: string
  profileReviewStatus: "draft" | "pending_review" | "approved" | "rejected"
}

export default function TakumiProfileRevocationsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loadingSnippets, setLoadingSnippets] = useState(true)
  const [savingSnippet, setSavingSnippet] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newBody, setNewBody] = useState("")

  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [experts, setExperts] = useState<ExpertHit[]>([])
  const [selectedExpertId, setSelectedExpertId] = useState("")
  const [selectedSnippetId, setSelectedSnippetId] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [revoking, setRevoking] = useState(false)

  const activeSnippets = useMemo(() => snippets.filter((s) => s.isActive), [snippets])
  const approvedExperts = useMemo(
    () => experts.filter((e) => e.profileReviewStatus === "approved"),
    [experts],
  )

  const loadSnippets = useCallback(async () => {
    setLoadingSnippets(true)
    try {
      const res = await fetch("/api/admin/takumi-profile-revoke-snippets")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Fehler beim Laden der Textbausteine.")
      setSnippets(Array.isArray(data.snippets) ? data.snippets : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Laden.")
      setSnippets([])
    } finally {
      setLoadingSnippets(false)
    }
  }, [])

  useEffect(() => {
    loadSnippets()
  }, [loadSnippets])

  async function createSnippet() {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error("Titel und Text sind erforderlich.")
      return
    }
    setSavingSnippet(true)
    try {
      const res = await fetch("/api/admin/takumi-profile-revoke-snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Textbaustein konnte nicht erstellt werden.")
      setNewTitle("")
      setNewBody("")
      toast.success("Textbaustein erstellt.")
      await loadSnippets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen.")
    } finally {
      setSavingSnippet(false)
    }
  }

  async function removeSnippet(id: string) {
    try {
      const res = await fetch(`/api/admin/takumi-profile-revoke-snippets/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.")
      toast.success("Textbaustein gelöscht.")
      await loadSnippets()
      if (selectedSnippetId === id) setSelectedSnippetId("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.")
    }
  }

  async function searchExperts() {
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/experts?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Suche fehlgeschlagen.")
      setExperts(Array.isArray(data.experts) ? data.experts : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler bei der Suche.")
      setExperts([])
    } finally {
      setSearching(false)
    }
  }

  async function revokeApproval() {
    if (!selectedExpertId) {
      toast.error("Bitte zuerst einen Takumi auswählen.")
      return
    }
    if (!selectedSnippetId && !customMessage.trim()) {
      toast.error("Bitte Textbaustein wählen oder eine individuelle Nachricht eingeben.")
      return
    }
    setRevoking(true)
    try {
      const res = await fetch("/api/admin/takumi-profile-revocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertId: selectedExpertId,
          snippetId: selectedSnippetId || undefined,
          customMessage: customMessage.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Freigabe konnte nicht entzogen werden.")
      toast.success("Freigabe entzogen und Benachrichtigung versendet.")
      setSelectedExpertId("")
      setCustomMessage("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Entziehen.")
    } finally {
      setRevoking(false)
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-8">
        <Button asChild variant="ghost" size="sm" className="w-fit gap-1">
          <Link href="/admin">
            <ArrowLeft className="size-4" />
            Zurück zu Admin
          </Link>
        </Button>

        <h1 className="text-xl font-semibold text-foreground">Takumi-Freigabe manuell entziehen</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1) Textbausteine verwalten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                placeholder="Titel, z. B. Richtlinienverstoß"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Button onClick={createSnippet} disabled={savingSnippet} className="gap-2">
                {savingSnippet ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Baustein speichern
              </Button>
            </div>
            <Textarea
              placeholder="Benachrichtigungstext für den Nutzer..."
              className="min-h-[88px]"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
            />
            {loadingSnippets ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Lade Textbausteine...
              </div>
            ) : snippets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Textbausteine vorhanden.</p>
            ) : (
              <div className="space-y-2">
                {snippets.map((s) => (
                  <div key={s.id} className="rounded-lg border border-[rgba(231,229,227,0.6)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{s.body}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeSnippet(s.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2) Freigabe entziehen und benachrichtigen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Takumi suchen (Name / E-Mail)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button variant="outline" onClick={searchExperts} disabled={searching}>
                {searching ? <Loader2 className="size-4 animate-spin" /> : "Suchen"}
              </Button>
            </div>

            {experts.length > 0 && (
              <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-[rgba(231,229,227,0.6)] p-2">
                {experts.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      if (e.profileReviewStatus !== "approved") return
                      setSelectedExpertId(e.id)
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      e.profileReviewStatus !== "approved"
                        ? "cursor-not-allowed opacity-60"
                        : selectedExpertId === e.id
                          ? "bg-[rgba(6,78,59,0.1)] border border-[rgba(6,78,59,0.3)]"
                          : "hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{e.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{e.email}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({e.profileReviewStatus})</span>
                  </button>
                ))}
              </div>
            )}
            {experts.length > 0 && approvedExperts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                In der Trefferliste ist kein aktuell freigegebenes Profil (`approved`). Entzug ist nur für freigegebene Profile möglich.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Textbaustein wählen</p>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedSnippetId}
                onChange={(e) => setSelectedSnippetId(e.target.value)}
              >
                <option value="">-- Kein Baustein --</option>
                {activeSnippets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <Textarea
              placeholder="Optional: individuelle Nachricht (überschreibt Baustein)"
              className="min-h-[96px]"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
            />

            <Button
              variant="destructive"
              onClick={revokeApproval}
              disabled={revoking || !selectedExpertId}
              className="gap-2"
            >
              {revoking ? <Loader2 className="size-4 animate-spin" /> : null}
              Freigabe entziehen & Benachrichtigung senden
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ArrowLeft, Check, Loader2, X } from "lucide-react"

type Row = {
  expertId: string
  userId: string | null
  submittedAt: string | null
  name: string
  categoryName: string
  subcategory: string
  bio: string
  bioLive: string
  imageUrl: string
  user: { id: string; name: string; email: string; username: string | null; image: string | null } | null
}

export default function TakumiProfileReviewsPage() {
  const [items, setItems] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectText, setRejectText] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/takumi-profile-reviews")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen")
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function approve(expertId: string) {
    setBusyId(expertId)
    try {
      const res = await fetch("/api/admin/takumi-profile-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId, action: "approve" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Fehler")
      toast.success("Profil freigegeben.")
      setItems((prev) => prev.filter((i) => i.expertId !== expertId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setBusyId(null)
    }
  }

  async function reject(expertId: string) {
    setBusyId(expertId)
    try {
      const res = await fetch("/api/admin/takumi-profile-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expertId,
          action: "reject",
          reason: rejectText[expertId]?.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Fehler")
      toast.success("Profil abgelehnt — Nutzer sieht den Hinweis im Profil.")
      setItems((prev) => prev.filter((i) => i.expertId !== expertId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageContainer>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/admin">
              <ArrowLeft className="size-4" />
              Admin
            </Link>
          </Button>
        </div>
        <h1 className="text-xl font-semibold text-foreground">Takumi-Profilprüfung</h1>
        <p className="text-sm text-muted-foreground">
          Freigabe oder Ablehnung neuer und stark geänderter Profile. Ablehnungstext soll auf{" "}
          <a href="mailto:admin@diaiway.com" className="underline">
            admin@diaiway.com
          </a>{" "}
          verweisen (kein Waymail).
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Profile in Prüfung.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((row) => (
              <Card key={row.expertId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {row.user?.username || row.name}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {row.categoryName} · {row.subcategory}
                    </span>
                  </CardTitle>
                  {row.submittedAt && (
                    <p className="text-xs text-muted-foreground">
                      Eingereicht: {new Date(row.submittedAt).toLocaleString("de-DE")}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {row.bioLive.trim() ? (
                    <div>
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">Öffentlich (bisher)</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.bioLive}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">Neue Fachung (Arbeitsversion)</p>
                    <p className="text-sm whitespace-pre-wrap">{row.bio}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">
                      Ablehnung — optionaler Zusatz (Standardtext wird sonst verwendet)
                    </p>
                    <Textarea
                      value={rejectText[row.expertId] ?? ""}
                      onChange={(e) =>
                        setRejectText((prev) => ({ ...prev, [row.expertId]: e.target.value }))
                      }
                      placeholder="Optional: Zusatz zum Standardhinweis…"
                      className="min-h-[72px] text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={busyId === row.expertId}
                      onClick={() => approve(row.expertId)}
                    >
                      {busyId === row.expertId ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Freigeben
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      disabled={busyId === row.expertId}
                      onClick={() => reject(row.expertId)}
                    >
                      <X className="size-4" />
                      Ablehnen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

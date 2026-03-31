"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ChevronLeft, Loader2, Pencil, Plus, Search, Star, Trash2 } from "lucide-react"

type ExpertRow = { id: string; name: string; email: string }

type AdminUserRow = {
  id: string
  name: string
  username: string | null
  email: string
  appRole: string
}

type WrittenReview = {
  id: string
  expertId: string
  userId: string
  bookingId: string | null
  rating: number
  text: string
  createdAt: string
  expert: { id: string; name: string }
}

type ReceivedReview = WrittenReview & {
  reviewer: { id: string; name: string; email: string }
}

type BookingRow = {
  id: string
  date: string
  startTime: string
  expertId: string
  expertName: string
  status: string
  expertRating: number | null
  expertReviewText: string | null
  createdAt: string
}

type RatingsPayload = {
  user: {
    id: string
    name: string
    email: string
    appRole: string
    expert: { id: string; name: string } | null
  }
  writtenReviews: WrittenReview[]
  completedBookingsAsBooker: BookingRow[]
  receivedReviewsAsExpert: ReceivedReview[]
}

const STAR_OPTIONS = ["1", "2", "3", "4", "5"] as const

function AdminReviewsContent() {
  const [q, setQ] = useState("")
  const [usersLoading, setUsersLoading] = useState(false)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [data, setData] = useState<RatingsPayload | null>(null)
  const [dataLoading, setDataLoading] = useState(false)

  const [reviewDialog, setReviewDialog] = useState<WrittenReview | ReceivedReview | null>(null)
  const [reviewRating, setReviewRating] = useState("5")
  const [reviewText, setReviewText] = useState("")
  const [reviewSaving, setReviewSaving] = useState(false)

  const [bookingDialog, setBookingDialog] = useState<BookingRow | null>(null)
  const [bookingStars, setBookingStars] = useState<string>("none")
  const [bookingText, setBookingText] = useState("")
  const [bookingSaving, setBookingSaving] = useState(false)

  const searchParams = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [createExpertQ, setCreateExpertQ] = useState("")
  const [createExperts, setCreateExperts] = useState<ExpertRow[]>([])
  const [createExpertId, setCreateExpertId] = useState("")
  const [createBookingId, setCreateBookingId] = useState("")
  const [createRating, setCreateRating] = useState("5")
  const [createText, setCreateText] = useState("")
  const [createSaving, setCreateSaving] = useState(false)
  const [createExpertLoading, setCreateExpertLoading] = useState(false)

  const searchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q.trim())}&limit=40`)
      const json = (await res.json()) as { users?: AdminUserRow[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Suche fehlgeschlagen")
      setUsers(json.users ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suche fehlgeschlagen")
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [q])

  const loadRatings = useCallback(async (userId: string) => {
    setDataLoading(true)
    setSelectedUserId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/ratings`)
      const json = (await res.json()) as RatingsPayload & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Laden fehlgeschlagen")
      setData(json as RatingsPayload)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Laden fehlgeschlagen")
      setData(null)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    void searchUsers()
    // Nur beim Mount: initiale Nutzerliste (leere Suche = letzte Registrierungen, begrenzt)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- q absichtlich nicht als Trigger
  }, [])

  const presetUserId = searchParams.get("userId")
  useEffect(() => {
    if (presetUserId) void loadRatings(presetUserId)
  }, [presetUserId, loadRatings])

  const searchExpertsForCreate = async () => {
    setCreateExpertLoading(true)
    setCreateExpertId("")
    try {
      const res = await fetch(`/api/admin/experts?q=${encodeURIComponent(createExpertQ.trim())}`)
      const json = (await res.json()) as { experts?: ExpertRow[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? "Suche fehlgeschlagen")
      const list = json.experts ?? []
      setCreateExperts(list)
      if (list.length === 1) setCreateExpertId(list[0].id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suche fehlgeschlagen")
      setCreateExperts([])
    } finally {
      setCreateExpertLoading(false)
    }
  }

  const openCreateDialog = () => {
    if (!selectedUserId) {
      toast.error("Bitte zuerst einen Nutzer auswählen (Treffer öffnen).")
      return
    }
    setCreateExpertQ("")
    setCreateExperts([])
    setCreateExpertId("")
    setCreateBookingId("")
    setCreateRating("5")
    setCreateText("")
    setCreateOpen(true)
  }

  const submitCreateReview = async () => {
    if (!selectedUserId || !createExpertId) {
      toast.error("Bitte einen Takumi aus der Liste wählen (Suche ausführen und Eintrag wählen).")
      return
    }
    setCreateSaving(true)
    try {
      const body: Record<string, unknown> = {
        userId: selectedUserId,
        expertId: createExpertId,
        rating: Math.min(5, Math.max(1, Number(createRating) || 5)),
        text: createText,
      }
      if (createBookingId.trim()) body.bookingId = createBookingId.trim()
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Anlegen fehlgeschlagen")
      toast.success("Review angelegt.")
      setCreateOpen(false)
      await loadRatings(selectedUserId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anlegen fehlgeschlagen")
    } finally {
      setCreateSaving(false)
    }
  }

  const deleteReview = async (reviewId: string) => {
    if (!confirm("Diese öffentliche Review wirklich löschen? Die Takumi-Sterne werden neu berechnet.")) return
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, { method: "DELETE" })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Löschen fehlgeschlagen")
      toast.success("Review gelöscht.")
      if (selectedUserId) await loadRatings(selectedUserId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen")
    }
  }

  const openReviewEdit = (r: WrittenReview | ReceivedReview) => {
    setReviewDialog(r)
    setReviewRating(String(Math.round(r.rating)))
    setReviewText(r.text ?? "")
  }

  const saveReview = async () => {
    if (!reviewDialog) return
    const r = Math.min(5, Math.max(1, Number(reviewRating) || 1))
    setReviewSaving(true)
    try {
      const res = await fetch(`/api/admin/reviews/${reviewDialog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: r, text: reviewText }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Speichern fehlgeschlagen")
      toast.success("Review gespeichert. Experten-Sterne wurden neu berechnet.")
      setReviewDialog(null)
      if (selectedUserId) await loadRatings(selectedUserId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen")
    } finally {
      setReviewSaving(false)
    }
  }

  const openBookingEdit = (b: BookingRow) => {
    setBookingDialog(b)
    setBookingStars(b.expertRating != null ? String(Math.round(b.expertRating)) : "none")
    setBookingText(b.expertReviewText ?? "")
  }

  const saveBookingRating = async () => {
    if (!bookingDialog) return
    setBookingSaving(true)
    try {
      const body: { expertRating?: number | null; expertReviewText: string } = {
        expertReviewText: bookingText,
      }
      if (bookingStars === "none") body.expertRating = null
      else body.expertRating = Math.min(5, Math.max(1, Number(bookingStars) || 1))

      const res = await fetch(`/api/admin/bookings/${bookingDialog.id}/booker-rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Speichern fehlgeschlagen")
      toast.success("Takumi-Bewertung gespeichert.")
      setBookingDialog(null)
      if (selectedUserId) await loadRatings(selectedUserId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen")
    } finally {
      setBookingSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[rgba(245,245,244,0.3)]">
      <PageContainer className="max-w-5xl py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/admin">
              <ChevronLeft className="size-4" />
              Admin
            </Link>
          </Button>
        </div>

        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[rgba(245,158,11,0.15)]">
            <Star className="size-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bewertungen je Nutzer</h1>
            <p className="text-sm text-muted-foreground">
              Öffentliche Reviews (Shugyo → Takumi), Takumi-Sterne auf Buchungen und erhaltene Reviews für
              Takumi-Profile bearbeiten.
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nutzer suchen</CardTitle>
            <CardDescription>Name, E-Mail oder Benutzername</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="user-q">Suche</Label>
              <Input
                id="user-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void searchUsers()}
                placeholder="z. B. max@…"
              />
            </div>
            <Button type="button" onClick={() => void searchUsers()} disabled={usersLoading} className="gap-2">
              {usersLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Suchen
            </Button>
          </CardContent>
        </Card>

        {users.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Treffer</CardTitle>
            </CardHeader>
            <CardContent className="max-h-56 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className={selectedUserId === u.id ? "bg-[rgba(245,245,244,0.5)]" : undefined}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{u.appRole}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => void loadRatings(u.id)}>
                          Öffnen
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {dataLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="size-5 animate-spin" />
            Lade Bewertungen…
          </div>
        )}

        {data && !dataLoading && (
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{data.user.name}</CardTitle>
                <CardDescription>{data.user.email}</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-base">Abgegebene öffentliche Reviews</CardTitle>
                  <CardDescription>Bewertungen dieses Nutzers über Takumis (Sterne + Text)</CardDescription>
                </div>
                <Button type="button" size="sm" variant="secondary" className="gap-1 shrink-0" onClick={openCreateDialog}>
                  <Plus className="size-4" />
                  Neue Review
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.writtenReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Einträge. Über „Neue Review“ kannst du eine Bewertung manuell anlegen.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Takumi</TableHead>
                        <TableHead>Sterne</TableHead>
                        <TableHead>Text</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="w-[100px] text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.writtenReviews.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.expert.name}</TableCell>
                          <TableCell>{r.rating}</TableCell>
                          <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                            {r.text || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {new Date(r.createdAt).toLocaleString("de-DE")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0">
                              <Button size="icon" variant="ghost" onClick={() => openReviewEdit(r)} aria-label="Bearbeiten">
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => void deleteReview(r.id)}
                                aria-label="Löschen"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Takumi-Bewertungen (Buchungen)</CardTitle>
                <CardDescription>
                  Sterne und Kommentar des Takumi für diesen Nutzer je abgeschlossener Session
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.completedBookingsAsBooker.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine abgeschlossenen Buchungen.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Takumi</TableHead>
                        <TableHead>Termin</TableHead>
                        <TableHead>Sterne</TableHead>
                        <TableHead>Text</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.completedBookingsAsBooker.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.expertName}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {b.date} {b.startTime}
                          </TableCell>
                          <TableCell>{b.expertRating ?? "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {b.expertReviewText || "—"}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => openBookingEdit(b)} aria-label="Bearbeiten">
                              <Pencil className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {data.user.expert && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Erhaltene öffentliche Reviews (als Takumi)</CardTitle>
                  <CardDescription>Bewertungen, die andere Nutzer über {data.user.expert.name} abgegeben haben</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {data.receivedReviewsAsExpert.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Einträge.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reviewer</TableHead>
                          <TableHead>Sterne</TableHead>
                          <TableHead>Text</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead className="w-[100px] text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.receivedReviewsAsExpert.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{r.reviewer.name}</div>
                              <div className="text-xs text-muted-foreground">{r.reviewer.email}</div>
                            </TableCell>
                            <TableCell>{r.rating}</TableCell>
                            <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                              {r.text || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                              {new Date(r.createdAt).toLocaleString("de-DE")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0">
                                <Button size="icon" variant="ghost" onClick={() => openReviewEdit(r)} aria-label="Bearbeiten">
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => void deleteReview(r.id)}
                                  aria-label="Löschen"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog open={!!reviewDialog} onOpenChange={(o) => !o && setReviewDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Review bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Sterne (1–5)</Label>
                <Select value={reviewRating} onValueChange={setReviewRating}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAR_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rev-text">Text</Label>
                <Textarea id="rev-text" value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={5} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog(null)}>
                Abbrechen
              </Button>
              <Button onClick={() => void saveReview()} disabled={reviewSaving}>
                {reviewSaving ? <Loader2 className="size-4 animate-spin" /> : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!bookingDialog} onOpenChange={(o) => !o && setBookingDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Takumi-Bewertung (Buchung)</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Sterne</Label>
                <Select value={bookingStars} onValueChange={setBookingStars}>
                  <SelectTrigger>
                    <SelectValue placeholder="Keine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine / entfernen</SelectItem>
                    {STAR_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="book-text">Kommentar</Label>
                <Textarea id="book-text" value={bookingText} onChange={(e) => setBookingText(e.target.value)} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBookingDialog(null)}>
                Abbrechen
              </Button>
              <Button onClick={() => void saveBookingRating()} disabled={bookingSaving}>
                {bookingSaving ? <Loader2 className="size-4 animate-spin" /> : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Neue öffentliche Review</DialogTitle>
              <DialogDescription>
                Der Reviewer ist der aktuell ausgewählte Nutzer ({data?.user.name ?? "—"}). Wähle den bewerteten Takumi
                über die Suche.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="expert-q">Takumi suchen</Label>
                <div className="flex gap-2">
                  <Input
                    id="expert-q"
                    value={createExpertQ}
                    onChange={(e) => setCreateExpertQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void searchExpertsForCreate()}
                    placeholder="Name oder E-Mail"
                  />
                  <Button type="button" variant="secondary" onClick={() => void searchExpertsForCreate()} disabled={createExpertLoading}>
                    {createExpertLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Takumi</Label>
                <Select value={createExpertId || undefined} onValueChange={setCreateExpertId}>
                  <SelectTrigger>
                    <SelectValue placeholder={createExperts.length ? "Takumi wählen" : "Zuerst suchen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {createExperts.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name} {ex.email ? `(${ex.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-booking">Buchungs-ID (optional)</Label>
                <Input
                  id="create-booking"
                  value={createBookingId}
                  onChange={(e) => setCreateBookingId(e.target.value)}
                  placeholder="Nur wenn die Review zu einer Session gehört"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Sterne (1–5)</Label>
                <Select value={createRating} onValueChange={setCreateRating}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAR_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-text">Text</Label>
                <Textarea id="create-text" value={createText} onChange={(e) => setCreateText(e.target.value)} rows={4} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={() => void submitCreateReview()} disabled={createSaving}>
                {createSaving ? <Loader2 className="size-4 animate-spin" /> : "Anlegen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </div>
  )
}

export default function AdminReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[rgba(245,245,244,0.3)] flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <AdminReviewsContent />
    </Suspense>
  )
}

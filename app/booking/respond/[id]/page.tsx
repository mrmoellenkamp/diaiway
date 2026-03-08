"use client"

import { use, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, MessageSquare, ArrowRight, AlertTriangle } from "lucide-react"
import Link from "next/link"

type Action = "confirmed" | "declined" | "ask" | null
type Phase = "loading" | "confirm" | "form" | "done" | "error"

interface BookingInfo {
  id: string
  userId?: string
  expertId?: string
  userName: string
  userEmail: string
  expertName: string
  date: string
  startTime: string
  endTime: string
  price: number
  note: string
  status: string
}

export default function RespondPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const token  = searchParams.get("token")  || ""
  const action = searchParams.get("action") as Action

  const [phase,   setPhase]   = useState<Phase>("loading")
  const [booking, setBooking] = useState<BookingInfo | null>(null)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState("")

  // Load booking info for display (token from email link, or session for logged-in expert)
  useEffect(() => {
    const url = token ? `/api/booking-respond/${id}?token=${token}` : `/api/booking-respond/${id}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setPhase("error"); setError(data.error); return }
        setBooking(data)
        if (data.status !== "pending") {
          setPhase("done")
          setError(`Diese Buchung wurde bereits als „${data.status}" markiert.`)
          return
        }
        setPhase(action === "ask" ? "form" : "confirm")
      })
      .catch(() => { setPhase("error"); setError("Fehler beim Laden der Buchung.") })
  }, [id, token, action])

  async function handleAction(act: "confirmed" | "declined") {
    setSending(true)
    try {
      const res = await fetch(`/api/booking-respond/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: act }),
      })
      const data = await res.json()
      if (res.ok) { setPhase("done") }
      else { setError(data.error || "Fehler"); setPhase("error") }
    } finally { setSending(false) }
  }

  async function handleAsk() {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/booking-respond/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "ask", message }),
      })
      const data = await res.json()
      if (res.ok) { setPhase("done") }
      else { setError(data.error || "Fehler"); setPhase("error") }
    } finally { setSending(false) }
  }

  // ─── UI ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-900">
              <span className="text-sm font-bold text-white">di</span>
            </div>
            <span className="text-xl font-bold text-stone-900">
              di<span className="text-amber-500">Ai</span>way
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          {/* Loading */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 p-12">
              <Loader2 className="size-8 animate-spin text-emerald-700" />
              <p className="text-sm text-stone-500">Buchung wird geladen…</p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50">
                <AlertTriangle className="size-7 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 mb-1">Fehler</h2>
                <p className="text-sm text-stone-500">{error}</p>
              </div>
              <Link href="/sessions" className="text-sm text-emerald-700 underline">
                Zum Dashboard
              </Link>
            </div>
          )}

          {/* Done */}
          {phase === "done" && (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 className="size-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 mb-1">
                  {error ? "Bereits verarbeitet" : "Erledigt!"}
                </h2>
                <p className="text-sm text-stone-500">
                  {error || "Der Nutzer wurde per E-Mail benachrichtigt."}
                </p>
              </div>
              <Link
                href="/sessions"
                className="flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
              >
                Zum Dashboard <ArrowRight className="size-4" />
              </Link>
            </div>
          )}

          {/* Confirm action */}
          {phase === "confirm" && booking && (
            <>
              <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 px-6 py-5">
                <h2 className="text-lg font-bold text-white">Buchungsanfrage</h2>
                <p className="text-xs text-emerald-100 mt-0.5">
                  von {booking.userId ? (
                    <Link href={`/user/${booking.userId}`} className="underline hover:text-emerald-50">
                      {booking.userName}
                    </Link>
                  ) : (
                    booking.userName
                  )}
                </p>
              </div>
              <div className="p-6 flex flex-col gap-5">
                {/* Details */}
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 flex flex-col gap-2">
                  <Row
                    label="Nutzer"
                    value={`${booking.userName} (${booking.userEmail})`}
                    userNameLink={booking.userId ? `/user/${booking.userId}` : undefined}
                    userName={booking.userName}
                  />
                  <Row label="Datum" value={booking.date} />
                  <Row label="Zeit" value={`${booking.startTime}–${booking.endTime} Uhr`} />
                  <Row label="Preis" value={`${booking.price} €`} />
                  {booking.note && <Row label="Nachricht" value={booking.note} />}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    className="h-12 gap-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold"
                    onClick={() => handleAction("confirmed")}
                    disabled={sending}
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Buchung annehmen
                  </Button>
                  <Button
                    className="h-12 gap-2 rounded-xl"
                    variant="destructive"
                    onClick={() => handleAction("declined")}
                    disabled={sending}
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                    Buchung ablehnen
                  </Button>
                  <Button
                    className="h-11 gap-2 rounded-xl"
                    variant="outline"
                    onClick={() => setPhase("form")}
                    disabled={sending}
                  >
                    <MessageSquare className="size-4" />
                    Rückfrage stellen
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Ask question form */}
          {phase === "form" && booking && (
            <>
              <div className="bg-gradient-to-r from-stone-800 to-stone-700 px-6 py-5">
                <h2 className="text-lg font-bold text-white">
                  Rückfrage an {booking.userId ? (
                    <Link href={`/user/${booking.userId}`} className="underline hover:text-stone-200">
                      {booking.userName}
                    </Link>
                  ) : (
                    booking.userName
                  )}
                </h2>
                <p className="text-xs text-stone-300 mt-0.5">
                  Deine Nachricht wird per E-Mail zugestellt.
                </p>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 flex flex-col gap-1.5 text-sm">
                  <Row label="Datum" value={booking.date} />
                  <Row label="Zeit" value={`${booking.startTime}–${booking.endTime} Uhr`} />
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Deine Frage oder Anmerkung zur Buchungsanfrage…"
                  rows={5}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setPhase("confirm")}
                    disabled={sending}
                  >
                    Zurück
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white gap-2"
                    onClick={handleAsk}
                    disabled={sending || !message.trim()}
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
                    Senden
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  userNameLink,
  userName,
}: {
  label: string
  value: string
  userNameLink?: string
  userName?: string
}) {
  let content: React.ReactNode = value
  if (userNameLink && userName && value.startsWith(userName)) {
    const rest = value.slice(userName.length)
    content = (
      <>
        <Link href={userNameLink} className="text-emerald-700 underline hover:text-emerald-800">
          {userName}
        </Link>
        {rest}
      </>
    )
  }
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-stone-700 shrink-0 w-24">{label}:</span>
      <span className="text-stone-600">{content}</span>
    </div>
  )
}

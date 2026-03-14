"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Send } from "lucide-react"

/**
 * Platzhalter für das Support-Ticket-System.
 * Wird später an ein Backend angebunden (API-Call, Zustellung per E-Mail o.Ä.).
 */
export function SupportTicketForm() {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim() || !email.trim()) return

    setLoading(true)
    try {
      // TODO: Backend-Anbindung – z.B. POST /api/support/ticket
      // await fetch("/api/support/ticket", { method: "POST", body: JSON.stringify({ subject, message, email }) })
      await new Promise((r) => setTimeout(r, 800)) // Simuliert API-Call
      setSent(true)
      setSubject("")
      setMessage("")
      setEmail("")
    } catch {
      // Fehlerbehandlung bei Backend-Anbindung
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Vielen Dank! Dein Ticket wurde erstellt. Wir melden uns in Kürze bei dir.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setSent(false)}
        >
          Weiteres Ticket erstellen
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Deine E-Mail
        </label>
        <Input
          type="email"
          placeholder="deine@email.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-9"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Betreff
        </label>
        <Input
          placeholder="Kurze Beschreibung deines Anliegens"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="h-9"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Nachricht
        </label>
        <Textarea
          placeholder="Beschreibe dein Anliegen so detailliert wie möglich..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="resize-none text-sm"
        />
      </div>
      <Button type="submit" disabled={loading} className="gap-2">
        <Send className="size-4" />
        {loading ? "Wird gesendet..." : "Ticket erstellen"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Hinweis: Das Support-Ticket-System wird demnächst an unser Backend angebunden. Aktuell wird deine Nachricht simuliert gespeichert.
      </p>
    </form>
  )
}

"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface MessageComposeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientName: string
  recipientExpertId: string
  onSent?: () => void
}

export function MessageComposeModal({
  open,
  onOpenChange,
  recipientName,
  recipientExpertId,
  onSent,
}: MessageComposeModalProps) {
  const { t } = useI18n()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const sub = subject.trim()
    const text = message.trim()
    if (!sub || !text || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientExpertId,
          text,
          subject: sub,
          communicationType: "MAIL",
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubject("")
        setMessage("")
        onOpenChange(false)
        onSent?.()
      } else {
        throw new Error(data.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-md rounded-none sm:rounded-lg">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base font-semibold">
            {t("takumiPage.writeTo", { name: recipientName })}
          </DialogTitle>
        </DialogHeader>
        {/* E-Mail-Editor-ähnliches Layout */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
              {t("takumiPage.to")}:
            </span>
            <span className="text-sm font-medium text-foreground">{recipientName}</span>
          </div>
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
              Betreff:
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff eingeben"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex flex-1 flex-col p-4">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messages.placeholder")}
              className="min-h-[120px] w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={4}
            />
            <div className="mt-3 flex justify-end">
              <Button
                onClick={handleSend}
                disabled={!subject.trim() || !message.trim() || sending}
                className="gap-2"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {t("common.send")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

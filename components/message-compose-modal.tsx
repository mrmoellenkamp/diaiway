"use client"

import { useState } from "react"
import Image from "next/image"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Send, Loader2, Paperclip, Check, XCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useSecureFileUpload } from "@/hooks/use-secure-file-upload"
import { toast } from "sonner"

function PendingAttachmentPreview({
  filename,
  thumbnailUrl,
  onConfirm,
  onRemove,
  sending,
  tapToConfirm,
}: {
  filename: string
  thumbnailUrl: string | null
  onConfirm: () => void
  onRemove: () => void
  sending: boolean
  tapToConfirm: string
}) {
  const [thumbError, setThumbError] = useState(false)
  const showThumb = thumbnailUrl && !thumbError
  const isPdf = filename.toLowerCase().endsWith(".pdf")

  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
      {showThumb ? (
        <Image
          src={thumbnailUrl!}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="size-14 shrink-0 rounded-lg object-cover"
          onError={() => setThumbError(true)}
        />
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
          {isPdf ? "📄" : "🖼️"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{filename}</p>
        <p className="text-xs text-muted-foreground">{tapToConfirm}</p>
      </div>
      <Button size="icon" className="shrink-0 rounded-full bg-primary text-primary-foreground" onClick={onConfirm} disabled={sending} aria-label="Anhang bestätigen und senden">
        <Check className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="shrink-0" onClick={onRemove} aria-label="Anhang entfernen">
        <XCircle className="size-4" />
      </Button>
    </div>
  )
}

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
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; thumbnailUrl: string | null; filename: string } | null>(null)
  const { upload, isScanning: uploadScanning, statusLabel, error: uploadError, reset: resetUpload, clearError: clearUploadError } = useSecureFileUpload()

  async function handleSend() {
    const sub = subject.trim()
    const text = message.trim()
    const attachment = pendingAttachment
    const hasAttachment = !!attachment
    if (!sub || (!text && !hasAttachment) || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientExpertId,
          text: text || "(Anhang)",
          subject: sub,
          communicationType: "MAIL",
          attachmentUrl: attachment?.url,
          attachmentThumbnailUrl: attachment?.thumbnailUrl,
          attachmentFilename: attachment?.filename,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubject("")
        setMessage("")
        setPendingAttachment(null)
        onOpenChange(false)
        onSent?.()
      } else {
        toast.error(data?.error ?? t("toast.sendError"))
      }
    } catch (e) {
      console.error(e)
      toast.error(t("toast.sendError"))
    } finally {
      setSending(false)
    }
  }

  async function handleAttach() {
    if (sending || uploadScanning) return
    const res = await upload()
    if (res.ok) {
      setPendingAttachment({ url: res.result.url, thumbnailUrl: res.result.thumbnailUrl, filename: res.result.filename })
      resetUpload()
    } else if (res.error) {
      toast.error(res.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 overflow-hidden w-[min(420px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] sm:max-h-[90vh] pb-safe rounded-xl border-0 shadow-xl">
        {/* Grüner Header: Waymail + X rechts */}
        <div className="flex items-center justify-between gap-3 bg-primary px-4 py-3 rounded-t-xl shrink-0">
          <span className="text-base font-semibold text-primary-foreground">{t("waymail.title")}</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground/90 hover:bg-white/20 transition-colors touch-manipulation"
            aria-label={t("common.close")}
          >
            <XCircle className="size-5" />
          </button>
        </div>
        {/* E-Mail-Editor-ähnliches Layout */}
        <div className="flex flex-col min-h-0 overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
              {t("takumiPage.to")}:
            </span>
            <span className="text-sm font-medium text-foreground">{recipientName}</span>
          </div>
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
              {t("waymail.subject")}
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("waymail.subjectPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex flex-1 flex-col p-4">
            {uploadError && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {uploadError}
                <button type="button" onClick={clearUploadError} className="shrink-0 ml-auto" aria-label="Schließen">
                  <XCircle className="size-3.5" />
                </button>
              </div>
            )}
            {pendingAttachment && (
              <PendingAttachmentPreview
                filename={pendingAttachment.filename}
                thumbnailUrl={pendingAttachment.thumbnailUrl}
                onConfirm={handleSend}
                onRemove={() => setPendingAttachment(null)}
                sending={sending}
                tapToConfirm={t("admin.tapToConfirm")}
              />
            )}
            {uploadScanning && (
              <p className="mb-2 text-xs text-muted-foreground">{statusLabel}</p>
            )}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messages.placeholder")}
              className="min-h-[120px] w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={4}
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleAttach}
                disabled={sending || uploadScanning}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                aria-label={t("waymail.attachAria")}
              >
                {uploadScanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </button>
              <Button
                onClick={handleSend}
                disabled={!subject.trim() || (!message.trim() && !pendingAttachment) || sending}
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

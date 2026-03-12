"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Send, Paperclip, Loader2, User, Check, XCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"
import { useSecureFileUpload } from "@/hooks/use-secure-file-upload"

interface MsgItem {
  id: string
  text: string
  sender: "user" | "partner"
  timestamp: number
  attachmentUrl?: string | null
  attachmentThumbnailUrl?: string | null
  attachmentFilename?: string | null
}

function MessageAttachment({
  url,
  thumbnailUrl,
  filename,
}: {
  url: string
  thumbnailUrl?: string | null
  filename?: string | null
}) {
  const isPdf = url.toLowerCase().endsWith(".pdf") || filename?.toLowerCase().endsWith(".pdf")
  return (
    <div className="mt-2">
      {isPdf ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-xs text-primary hover:underline"
        >
          📄 {filename || "PDF"}
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={thumbnailUrl || url}
            alt={filename || "Anhang"}
            className="max-h-40 rounded-lg object-contain"
            loading="lazy"
          />
        </a>
      )}
    </div>
  )
}

function PendingAttachmentPreview({
  url,
  thumbnailUrl,
  filename,
  onConfirm,
  onRemove,
  sending,
}: {
  url: string
  thumbnailUrl: string | null
  filename: string
  onConfirm: () => void
  onRemove: () => void
  sending: boolean
}) {
  const [thumbError, setThumbError] = useState(false)
  const showThumb = thumbnailUrl && !thumbError
  const isPdf = url.toLowerCase().endsWith(".pdf") || filename.toLowerCase().endsWith(".pdf")

  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
      {showThumb ? (
        <img
          src={thumbnailUrl!}
          alt=""
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
        <p className="text-xs text-muted-foreground">Zum Senden auf ✓ tippen</p>
      </div>
      <Button size="icon" className="size-9 shrink-0 rounded-full bg-primary text-primary-foreground" onClick={onConfirm} disabled={sending} aria-label="Anhang bestätigen und senden">
        <Check className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onRemove} aria-label="Anhang entfernen">
        <XCircle className="size-4" />
      </Button>
    </div>
  )
}

export interface UserChatBoxProps {
  partnerId: string
  partnerName: string
  partnerAvatar: string
  partnerImageUrl?: string | null
  expertId?: string | null
  subcategory?: string
  onClose: () => void
  /** Optional: Breite an PageContainer angleichen (max-w-lg) */
  inline?: boolean
  /** Wenn in Drawer/Bottom-Sheet: volle Höhe, keine äußere Umrandung */
  inDrawer?: boolean
}

export function UserChatBox({
  partnerId,
  partnerName,
  partnerAvatar,
  partnerImageUrl,
  expertId,
  subcategory,
  onClose,
  inline = true,
  inDrawer = false,
}: UserChatBoxProps) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<MsgItem[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; thumbnailUrl: string | null; filename: string } | null>(null)
  const { upload, phase: uploadPhase, statusLabel, reset: resetUpload } = useSecureFileUpload()
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (!partnerId) return
    setLoading(true)
    fetch(`/api/messages?with=${encodeURIComponent(partnerId)}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [partnerId])

  async function handleSend() {
    const text = input.trim()
    const attachment = pendingAttachment
    const hasAttachment = !!attachment
    if ((!text && !hasAttachment) || sending) return
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: MsgItem = {
      id: tempId,
      text: text || "(Anhang)",
      sender: "user",
      timestamp: Date.now(),
      attachmentUrl: attachment?.url,
      attachmentThumbnailUrl: attachment?.thumbnailUrl,
      attachmentFilename: attachment?.filename,
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setInput("")
    setPendingAttachment(null)
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUserId: partnerId,
          text: text || "(Anhang)",
          communicationType: "CHAT",
          attachmentUrl: attachment?.url,
          attachmentThumbnailUrl: attachment?.thumbnailUrl,
          attachmentFilename: attachment?.filename,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: data.id,
                  timestamp: data.timestamp,
                  attachmentUrl: data.attachmentUrl,
                  attachmentThumbnailUrl: data.attachmentThumbnailUrl,
                  attachmentFilename: data.attachmentFilename,
                }
              : m
          )
        )
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        toast.error(data.error || "Fehler")
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      toast.error("Fehler – Nachricht konnte nicht gesendet werden.")
    } finally {
      setSending(false)
    }
  }

  async function handleAttach() {
    if (sending) return
    const res = await upload()
    if (res.ok) {
      setPendingAttachment({ url: res.result.url, thumbnailUrl: res.result.thumbnailUrl, filename: res.result.filename })
      resetUpload()
    } else if (res.error) {
      resetUpload()
      toast.error(res.error)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden flex-1 min-h-0",
        !inDrawer && "rounded-2xl border border-primary/10 bg-emerald-50/50 backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200",
        inDrawer && "bg-background",
        inline ? "w-full max-w-lg" : "w-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-primary/8 bg-primary/[0.04] px-4 py-3">
        <button
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-primary/5"
          aria-label={t("common.close")}
        >
          <X className="size-4 text-foreground" />
        </button>
        <Avatar className="size-9 border border-primary/10 ring-1 ring-primary/10 shrink-0">
          {partnerImageUrl ? <AvatarImage src={partnerImageUrl} alt={partnerName} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{partnerAvatar}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {expertId ? (
              <Link href={`/takumi/${expertId}`} className="underline-offset-2 hover:underline">
                {partnerName}
              </Link>
            ) : (
              partnerName
            )}
          </p>
          {subcategory ? <p className="text-[10px] text-muted-foreground truncate">{subcategory}</p> : null}
        </div>
        {expertId && (
          <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs shrink-0">
            <Link href={`/takumi/${expertId}`}>{t("common.profile")}</Link>
          </Button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className={cn(
          "flex flex-1 flex-col gap-3 overflow-y-auto p-4 scrollbar-none min-h-[200px]",
          inDrawer ? "max-h-[60dvh]" : "max-h-[min(50vh,400px)]"
        )}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2.5", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}>
              <div
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold overflow-hidden",
                  msg.sender === "partner"
                    ? "bg-primary/10 ring-1 ring-primary/10 text-primary"
                    : "bg-accent/10 ring-1 ring-accent/10"
                )}
              >
                {msg.sender === "partner" ? (
                  partnerImageUrl ? (
                    <img src={partnerImageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    partnerAvatar
                  )
                ) : (
                  <User className="size-3.5 text-accent" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed",
                  msg.sender === "user"
                    ? "rounded-tr-md bg-primary/10 text-foreground"
                    : "rounded-tl-md border border-border/30 bg-white/80 text-foreground shadow-sm"
                )}
              >
                {msg.text}
                {msg.attachmentUrl && (
                  <MessageAttachment
                    url={msg.attachmentUrl}
                    thumbnailUrl={msg.attachmentThumbnailUrl}
                    filename={msg.attachmentFilename}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-primary/8 bg-white/40 px-3 py-2.5">
        {pendingAttachment && (
          <PendingAttachmentPreview
            url={pendingAttachment.url}
            thumbnailUrl={pendingAttachment.thumbnailUrl}
            filename={pendingAttachment.filename}
            onConfirm={handleSend}
            onRemove={() => setPendingAttachment(null)}
            sending={sending}
          />
        )}
        {uploadPhase === "scanning" || uploadPhase === "preview" ? (
          <p className="mb-2 text-xs text-muted-foreground">{statusLabel}</p>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl border border-border/40 bg-white/70 px-2.5 py-1.5">
          <button
            type="button"
            onClick={handleAttach}
            disabled={sending}
            className={cn(
              "mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary",
              sending && "pointer-events-none opacity-40"
            )}
            aria-label="Datei anhängen"
          >
            <Paperclip className="size-3.5" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={t("messages.placeholder")}
            disabled={sending}
            className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingAttachment) || sending}
            className={cn(
              "mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-all",
              (input.trim() || pendingAttachment) && !sending
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "text-muted-foreground/25"
            )}
            aria-label="Nachricht senden"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

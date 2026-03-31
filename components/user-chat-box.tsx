"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { X, Send, Paperclip, Loader2, User, Check, XCircle, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"
import { useI18n } from "@/lib/i18n"
import { toast } from "sonner"
import { useSecureFileUpload } from "@/hooks/use-secure-file-upload"
import { VerifiedBadge } from "@/components/verified-badge"
import { useApp } from "@/lib/app-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type MessageStatus = "sent" | "pending" | "failed"

interface MsgItem {
  id: string
  text: string
  sender: "user" | "partner"
  timestamp: number
  status?: MessageStatus
  retryCount?: number
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
          className="flex items-center gap-2 rounded-lg border border-[rgba(231,229,227,0.6)] bg-[rgba(245,245,244,0.3)] px-2 py-1.5 text-xs text-primary hover:underline"
        >
          📄 {filename || "PDF"}
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <Image
            src={thumbnailUrl || url}
            alt={filename || "Anhang"}
            width={300}
            height={160}
            unoptimized
            className="max-h-40 w-auto rounded-lg object-contain"
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
  tapToConfirm,
}: {
  url: string
  thumbnailUrl: string | null
  filename: string
  onConfirm: () => void
  onRemove: () => void
  sending: boolean
  tapToConfirm: string
}) {
  const [thumbError, setThumbError] = useState(false)
  const showThumb = thumbnailUrl && !thumbError
  const isPdf = url.toLowerCase().endsWith(".pdf") || filename.toLowerCase().endsWith(".pdf")

  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-[rgba(6,78,59,0.3)] bg-[rgba(6,78,59,0.1)] px-3 py-2">
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

export interface UserChatBoxProps {
  partnerId: string
  partnerName: string
  partnerAvatar: string
  partnerImageUrl?: string | null
  partnerIsVerified?: boolean
  expertId?: string | null
  subcategory?: string
  onClose: () => void
  /** Optional: Breite an PageContainer angleichen (max-w-lg) */
  inline?: boolean
  /** Wenn in Drawer/Bottom-Sheet: volle Höhe, keine äußere Umrandung */
  inDrawer?: boolean
  /** Nachrichten geladen (API markiert ungelesene als gelesen) → z.B. Glocken-Badge aktualisieren */
  onMessagesLoaded?: () => void
}

export function UserChatBox({
  partnerId,
  partnerName,
  partnerAvatar,
  partnerImageUrl,
  partnerIsVerified,
  expertId,
  subcategory,
  onClose,
  inline = true,
  inDrawer = false,
  onMessagesLoaded,
}: UserChatBoxProps) {
  const { t } = useI18n()
  const { userAvatar } = useApp()
  const selfImageSrc = userAvatar?.trim() || ""
  const [messages, setMessages] = useState<MsgItem[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; thumbnailUrl: string | null; filename: string } | null>(null)
  const { upload, phase: _uploadPhase, statusLabel, error: uploadError, isScanning: uploadScanning, reset: resetUpload, clearError: clearUploadError } = useSecureFileUpload()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [interactionLocked, setInteractionLocked] = useState(inDrawer)
  const [deleteMessageConfirm, setDeleteMessageConfirm] = useState<MsgItem | null>(null)

  useEffect(() => {
    if (!uploadError || !inDrawer) return
    const t = setTimeout(() => clearUploadError(), 10000)
    return () => clearTimeout(t)
  }, [uploadError, inDrawer, clearUploadError])

  useEffect(() => {
    if (!inDrawer) return
    setInteractionLocked(true)
    const t = setTimeout(() => setInteractionLocked(false), 300)
    return () => clearTimeout(t)
  }, [inDrawer])

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return
    const vv = window.visualViewport
    const handler = () => {
      const offset = Math.max(0, window.innerHeight - vv.height)
      setKeyboardOffset(offset)
      requestAnimationFrame(scrollToBottom)
    }
    vv.addEventListener("resize", handler)
    vv.addEventListener("scroll", handler)
    handler()
    return () => {
      vv.removeEventListener("resize", handler)
      vv.removeEventListener("scroll", handler)
    }
  }, [scrollToBottom])

  useEffect(() => {
    if (!partnerId) return
    setLoading(true)
    fetch(`/api/messages?with=${encodeURIComponent(partnerId)}`)
      .then((r) => r.json())
      .then((data) => {
        const msgs = (data.messages ?? []) as MsgItem[]
        setMessages(msgs.map((m) => ({ ...m, status: (m.status ?? "sent") as MessageStatus })))
        onMessagesLoaded?.()
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [partnerId, onMessagesLoaded])

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  const sendMessage = useCallback(
    async (payload: {
      recipientUserId: string
      text: string
      communicationType: string
      attachmentUrl?: string | null
      attachmentThumbnailUrl?: string | null
      attachmentFilename?: string | null
    }, msgId: string, retries = 0) => {
      const tempId = msgId
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
                    status: "sent" as MessageStatus,
                    attachmentUrl: data.attachmentUrl,
                    attachmentThumbnailUrl: data.attachmentThumbnailUrl,
                    attachmentFilename: data.attachmentFilename,
                  }
                : m
            )
          )
          return
        }
        throw new Error(data.error || "Fehler")
      } catch {
        if (retries < 3) {
          const delay = 2 ** retries * 1000
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, status: "pending" as MessageStatus, retryCount: retries + 1 } : m
            )
          )
          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null
            sendMessage(payload, tempId, retries + 1)
          }, delay)
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, status: "failed" as MessageStatus } : m))
          )
          toast.error(t("toast.messageSendFailed"))
        }
      }
    },
    [t]
  )

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
      status: "pending",
      retryCount: 0,
      attachmentUrl: attachment?.url,
      attachmentThumbnailUrl: attachment?.thumbnailUrl,
      attachmentFilename: attachment?.filename,
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setInput("")
    setPendingAttachment(null)
    setSending(true)
    await sendMessage(
      {
        recipientUserId: partnerId,
        text: text || "(Anhang)",
        communicationType: "CHAT",
        attachmentUrl: attachment?.url,
        attachmentThumbnailUrl: attachment?.thumbnailUrl,
        attachmentFilename: attachment?.filename,
      },
      tempId,
      0
    )
    setSending(false)
  }

  function requestDeleteMessage(msg: MsgItem, e: React.MouseEvent) {
    e.stopPropagation()
    if (msg.sender !== "user") return
    if (msg.id.startsWith("temp-")) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
      return
    }
    setDeleteMessageConfirm(msg)
  }

  async function doDeleteMessage(msg: MsgItem) {
    try {
      const r = await fetch(`/api/messages?message=${encodeURIComponent(msg.id)}`, { method: "DELETE" })
      if (r.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id))
        toast.success(t("messages.messageDeleted"))
      } else {
        const data = await r.json().catch(() => ({}))
        toast.error(data.error ?? t("common.networkError"))
      }
    } catch {
      toast.error(t("common.networkError"))
    }
  }

  function handleRetry(msg: MsgItem) {
    if (msg.sender !== "user" || msg.status !== "failed") return
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: "pending" as MessageStatus, retryCount: 0 } : m))
    )
    sendMessage(
      {
        recipientUserId: partnerId,
        text: msg.text,
        communicationType: "CHAT",
        attachmentUrl: msg.attachmentUrl,
        attachmentThumbnailUrl: msg.attachmentThumbnailUrl,
        attachmentFilename: msg.attachmentFilename,
      },
      msg.id,
      0
    )
  }

  async function handleAttach() {
    if (sending) return
    const res = await upload()
    if (res.ok) {
      setPendingAttachment({ url: res.result.url, thumbnailUrl: res.result.thumbnailUrl, filename: res.result.filename })
      resetUpload()
    }
    // Bei Fehler: error bleibt im Hook, wird unter dem Button angezeigt (kein Toast)
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden flex-1 min-h-0",
        !inDrawer && "rounded-2xl border border-[rgba(6,78,59,0.1)] bg-[rgba(236,253,245,0.5)] backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200",
        inDrawer && "bg-background",
        inline ? "w-full max-w-lg" : "w-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[rgba(6,78,59,0.08)] bg-[rgba(6,78,59,0.04)] px-4 py-3">
        <button
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full hover:bg-[rgba(6,78,59,0.05)]"
          aria-label={t("common.close")}
        >
          <X className="size-4 text-foreground" />
        </button>
        <Avatar className="size-9 border border-[rgba(6,78,59,0.1)] ring-1 ring-[rgba(6,78,59,0.1)] shrink-0">
          {partnerImageUrl ? <AvatarImage src={partnerImageUrl} alt={partnerName} /> : null}
          <AvatarFallback className="bg-[rgba(6,78,59,0.1)] text-primary text-xs font-semibold">{partnerAvatar}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
            {expertId ? (
              <Link href={`/takumi/${expertId}`} className="underline-offset-2 hover:underline">
                {partnerName}
              </Link>
            ) : (
              partnerName
            )}
            {partnerIsVerified && <VerifiedBadge size="sm" />}
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
        ref={(el) => {
          scrollRef.current = el
          if (el) scrollToBottom()
        }}
        className={cn(
          "flex flex-1 flex-col gap-3 overflow-y-auto p-4 scrollbar-none min-h-[200px]",
          inDrawer ? "max-h-60dvh-fallback" : "max-h-[min(50vh,400px)]"
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
                    ? "bg-[rgba(6,78,59,0.1)] ring-1 ring-[rgba(6,78,59,0.1)] text-primary"
                    : "bg-[rgba(34,197,94,0.1)] ring-1 ring-[rgba(34,197,94,0.1)]"
                )}
              >
                {msg.sender === "partner" ? (
                  partnerImageUrl ? (
                    <Image
                      src={partnerImageUrl}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    partnerAvatar
                  )
                ) : selfImageSrc ? (
                  <Image
                    src={selfImageSrc}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-3.5 text-accent" />
                )}
              </div>
              <div
                className={cn(
                  "relative max-w-[85%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed",
                  msg.sender === "user"
                    ? "rounded-tr-md bg-[rgba(6,78,59,0.1)] text-foreground"
                    : "rounded-tl-md border border-[rgba(231,229,227,0.3)] bg-[rgba(255,255,255,0.8)] text-foreground shadow-sm",
                  msg.sender === "user" && msg.status === "pending" && "opacity-70",
                  msg.sender === "user" && msg.status === "failed" && "ring-1 ring-[rgba(239,68,68,0.3)]"
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
                {msg.sender === "user" && msg.status === "failed" && (
                  <button
                    type="button"
                    onClick={() => handleRetry(msg)}
                    className="mt-2 flex items-center gap-1.5 text-[10px] text-destructive hover:underline"
                  >
                    <AlertCircle className="size-3 shrink-0" />
                    Tippe zum Wiederholen
                  </button>
                )}
                {msg.sender === "user" && (
                  <button
                    type="button"
                    onClick={(e) => requestDeleteMessage(msg, e)}
                    className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[rgba(245,245,244,0.8)] text-muted-foreground hover:bg-[rgba(239,68,68,0.2)] hover:text-destructive transition-colors"
                    aria-label={t("common.delete")}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input — mit Tastatur-Offset, damit das Feld bei geöffneter Tastatur sichtbar bleibt */}
      <div
        className="border-t border-[rgba(6,78,59,0.08)] bg-[rgba(255,255,255,0.4)] px-3 py-2.5 shrink-0"
        style={keyboardOffset > 0 ? { paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${keyboardOffset}px)` } : undefined}
      >
        {uploadError && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] px-3 py-2">
            <p className="min-w-0 flex-1 text-xs text-destructive" role="alert">
              {uploadError}
            </p>
            <button
              type="button"
              onClick={clearUploadError}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-[rgba(239,68,68,0.2)] touch-manipulation"
              aria-label="Fehlermeldung schließen"
            >
              <XCircle className="size-4" />
            </button>
          </div>
        )}
        {pendingAttachment && (
          <PendingAttachmentPreview
            url={pendingAttachment.url}
            thumbnailUrl={pendingAttachment.thumbnailUrl}
            filename={pendingAttachment.filename}
            onConfirm={handleSend}
            onRemove={() => setPendingAttachment(null)}
            sending={sending}
            tapToConfirm={t("admin.tapToConfirm")}
          />
        )}
        {uploadScanning ? (
          <p className="mb-2 text-xs text-muted-foreground">{statusLabel}</p>
        ) : null}
        <div className="flex items-end gap-2 rounded-xl border border-[rgba(231,229,227,0.4)] bg-[rgba(255,255,255,0.7)] px-2.5 py-1.5">
          <button
            type="button"
            onClick={handleAttach}
            disabled={sending || uploadScanning || interactionLocked}
            className={cn(
              "mb-0.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[rgba(6,78,59,0.05)] hover:text-primary touch-manipulation",
              (sending || uploadScanning || interactionLocked) && "pointer-events-none opacity-40"
            )}
            aria-label="Datei anhängen"
            aria-busy={uploadScanning}
          >
            {uploadScanning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Paperclip className="size-3.5" />
            )}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={t("messages.placeholder")}
            disabled={sending || interactionLocked}
            inputMode="text"
            enterKeyHint="send"
            autoCorrect="on"
            spellCheck={true}
            autoComplete="off"
            rows={1}
            className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base leading-relaxed text-foreground placeholder:text-[rgba(120,113,108,0.4)] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingAttachment) || sending || interactionLocked}
            className={cn(
              "mb-0.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition-all touch-manipulation",
              (input.trim() || pendingAttachment) && !sending
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-[rgba(6,78,59,0.9)]"
                : "text-[rgba(120,113,108,0.25)]"
            )}
            aria-label="Nachricht senden"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Lösch-Bestätigung für Nachricht */}
      <AlertDialog open={!!deleteMessageConfirm} onOpenChange={(open) => !open && setDeleteMessageConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("messages.deleteMessageConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("messages.deleteMessageConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteMessageConfirm) {
                  doDeleteMessage(deleteMessageConfirm)
                  setDeleteMessageConfirm(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-[rgba(239,68,68,0.9)]"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

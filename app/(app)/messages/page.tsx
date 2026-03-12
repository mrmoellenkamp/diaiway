"use client"

import { useState, useEffect, useCallback, Suspense, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, Send, MessageSquare, Bell, Calendar, CheckCircle2, XCircle, MessageCircle, Loader2, Paperclip, Check, User } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useI18n } from "@/lib/i18n"
import { useApp } from "@/lib/app-context"
import { formatTimeBerlin } from "@/lib/date-utils"
import { toast } from "sonner"
import { useSecureFileUpload } from "@/hooks/use-secure-file-upload"

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
          <LazyImage src={thumbnailUrl || url} alt={filename || "Anhang"} className="max-h-40 rounded-lg object-contain" />
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
      <Button
        variant="default"
        size="icon"
        className="size-9 shrink-0 rounded-full bg-primary text-primary-foreground"
        onClick={onConfirm}
        disabled={sending}
        aria-label="Anhang bestätigen und senden"
      >
        <Check className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onRemove}
        aria-label="Anhang entfernen"
      >
        <XCircle className="size-4" />
      </Button>
    </div>
  )
}

function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true)
      },
      { rootMargin: "100px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn("min-h-20", !inView && "bg-muted/30")}>
      {inView && (
        <img
          src={src}
          alt={alt}
          className={cn(className, !loaded && "animate-pulse bg-muted/30")}
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  )
}

interface NotificationItem {
  id: string
  type: string
  bookingId: string | null
  title: string
  body: string
  read: boolean
  createdAt: string
}

interface ThreadInfo {
  partnerId: string
  partnerName: string
  partnerAvatar: string
  subcategory: string
  expertId: string | null
  isOnline?: boolean
  lastMessage: { text: string; sender: string; timestamp: number } | null
  unread: number
}

interface MsgItem {
  id: string
  text: string
  sender: "user" | "partner"
  timestamp: number
  attachmentUrl?: string | null
  attachmentThumbnailUrl?: string | null
  attachmentFilename?: string | null
}

function MessagesPageContent() {
  const { t } = useI18n()
  const { refreshNotificationCount } = useApp()
  const searchParams = useSearchParams()
  const withParam = searchParams.get("with")

  const [threads, setThreads] = useState<ThreadInfo[]>([])
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [messages, setMessages] = useState<MsgItem[]>([])
  const [input, setInput] = useState("")
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [actingId, setActingId] = useState<string | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; thumbnailUrl: string | null; filename: string } | null>(null)
  const { upload, phase: uploadPhase, error: uploadError, statusLabel, reset: resetUpload } = useSecureFileUpload()

  const fetchThreads = useCallback(async () => {
    const r = await fetch("/api/messages")
    if (r.ok) {
      const data = await r.json()
      setThreads(data.threads ?? [])
    }
    setLoadingThreads(false)
  }, [])

  const fetchNotifications = useCallback(async () => {
    const r = await fetch("/api/notifications")
    const data = r.ok ? await r.json() : null
    if (data?.notifications) setNotifications(data.notifications)
    refreshNotificationCount?.()
  }, [refreshNotificationCount])

  useEffect(() => {
    fetchThreads()
    fetchNotifications()
    const interval = setInterval(() => {
      fetchThreads()
      fetchNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchThreads, fetchNotifications])

  // Open thread from URL ?with=userId
  useEffect(() => {
    if (withParam && !activeThread) {
      setActiveThread(withParam)
    }
  }, [withParam])

  useEffect(() => {
    if (!activeThread) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
    fetch(`/api/messages?with=${encodeURIComponent(activeThread)}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? [])
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false))
  }, [activeThread])

  async function handleSend() {
    const text = input.trim()
    const attachment = pendingAttachment
    const hasAttachment = !!attachment
    if ((!text && !hasAttachment) || !activeThread || sending) return
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
          recipientUserId: activeThread,
          text: text || "(Anhang)",
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
        fetchThreads()
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

  const thread = threads.find((th) => th.partnerId === activeThread)

  const markAsRead = (ids: string[]) => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => {
        if (r.ok) {
          setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)))
        }
      })
      .catch(() => {})
  }

  async function handleBookingAction(bookingId: string, action: "confirmed" | "declined", notificationId: string) {
    setActingId(notificationId)
    try {
      const res = await fetch(`/api/booking-respond/${bookingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        import("@/lib/native-utils").then(({ hapticSuccess }) => hapticSuccess())
        toast.success(action === "confirmed" ? t("messages.bookingConfirmedToast") : t("messages.bookingDeclinedToast"))
        markAsRead([notificationId])
        setNotifications((prev) => prev.map((no) => (no.id === notificationId ? { ...no, read: true } : no)))
        fetchThreads()
      } else {
        toast.error(data.error || "Fehler")
      }
    } catch {
      toast.error("Fehler")
    } finally {
      setActingId(null)
    }
  }

  const NotificationIcon = ({ type }: { type: string }) => {
    if (type === "booking_request") return <Calendar className="size-4" />
    if (type === "booking_confirmed") return <CheckCircle2 className="size-4 text-green-600" />
    if (type === "booking_declined") return <XCircle className="size-4 text-destructive" />
    if (type === "booking_question" || type === "new_message") return <MessageCircle className="size-4" />
    return <Bell className="size-4" />
  }

  const unreadNotifications = notifications.filter((n) => !n.read)

  // Thread detail view – Layout angelehnt an AI-Chatbox
  if (activeThread && thread) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl border border-primary/10 bg-emerald-50/50 backdrop-blur-md shadow-xl pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-primary/8 bg-primary/[0.04] px-4 py-3">
          <button onClick={() => setActiveThread(null)} className="flex size-8 items-center justify-center rounded-full hover:bg-primary/5">
            <ArrowLeft className="size-4 text-foreground" />
          </button>
          <Avatar className="size-9 border border-primary/10 ring-1 ring-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {thread.partnerAvatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {thread.expertId ? (
                <Link href={`/takumi/${thread.expertId}`} className="underline-offset-2 hover:underline">
                  {thread.partnerName}
                </Link>
              ) : (
                thread.partnerName
              )}
            </p>
            {thread.subcategory ? (
              <p className="text-[10px] text-muted-foreground truncate">{thread.subcategory}</p>
            ) : null}
          </div>
          {thread.expertId && (
            <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs shrink-0">
              <Link href={`/takumi/${thread.expertId}`}>{t("common.profile")}</Link>
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 scrollbar-none min-h-0">
          {loadingMessages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-2.5", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    msg.sender === "partner"
                      ? "bg-primary/10 ring-1 ring-primary/10 text-primary"
                      : "bg-accent/10 ring-1 ring-accent/10"
                  )}
                >
                  {msg.sender === "partner" ? (
                    thread.partnerAvatar
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

        {/* Input Bar – wie AI-Chatbox */}
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

  // Thread list view
  return (
    <PageContainer>
      {unreadNotifications.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t("messages.bookingAlerts")}</h3>
          {unreadNotifications
            .filter((n) => n.type === "booking_request" || n.type === "booking_confirmed" || n.type === "booking_declined" || n.type === "booking_question")
            .slice(0, 10)
            .map((n) => (
              <Alert
                key={n.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50",
                  !n.read && "border-accent/50 bg-accent/5"
                )}
                onClick={() => {
                  markAsRead([n.id])
                  if (n.bookingId && n.type === "booking_request") {
                    window.location.href = `/booking/respond/${n.bookingId}`
                  } else if (n.bookingId) {
                    window.location.href = `/sessions`
                  } else if (n.type === "new_message") {
                    // Already on messages page
                  }
                }}
              >
                <NotificationIcon type={n.type} />
                <AlertTitle>{n.title}</AlertTitle>
                <AlertDescription>{n.body}</AlertDescription>
                {n.type === "booking_request" && n.bookingId && (
                  <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleBookingAction(n.bookingId!, "confirmed", n.id)}
                      disabled={actingId === n.id}
                    >
                      {actingId === n.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                      {t("messages.bookingConfirm")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs border-destructive/30 text-destructive"
                      onClick={() => handleBookingAction(n.bookingId!, "declined", n.id)}
                      disabled={actingId === n.id}
                    >
                      {t("messages.bookingDecline")}
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link href={`/booking/respond/${n.bookingId}`} onClick={(e) => { e.stopPropagation(); markAsRead([n.id]) }}>
                        {t("messages.bookingAsk")}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                      <Link href={`/booking/respond/${n.bookingId}`} onClick={(e) => e.stopPropagation()}>
                        {t("messages.bookingViewDetails")}
                      </Link>
                    </Button>
                  </div>
                )}
              </Alert>
            ))}
        </div>
      )}
      {loadingThreads ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : threads.length === 0 && unreadNotifications.filter((n) => n.type !== "new_message").length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <MessageSquare className="size-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("messages.empty")}</h2>
          <p className="max-w-xs text-sm text-muted-foreground">{t("messages.emptyDesc")}</p>
          <Button asChild className="mt-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/categories">{t("messages.discoverCategories")}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {threads.map((th) => {
            const lastMsg = th.lastMessage
            const time = lastMsg ? new Date(lastMsg.timestamp) : new Date()
            return (
              <div
                key={th.partnerId}
                role="button"
                tabIndex={0}
                onClick={() => setActiveThread(th.partnerId)}
                onKeyDown={(e) => e.key === "Enter" && setActiveThread(th.partnerId)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
              >
                <div className="relative">
                  <Avatar className="size-11 border border-primary/10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {th.partnerAvatar}
                    </AvatarFallback>
                  </Avatar>
                  {th.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex size-3 rounded-full bg-green-500 ring-2 ring-background" title={t("mentor.online")} />
                  )}
                  {th.unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                      {th.unread}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <div className="flex items-center justify-between">
                    {th.expertId ? (
                      <Link
                        href={`/takumi/${th.expertId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-semibold text-foreground underline-offset-2 hover:underline truncate"
                      >
                        {th.partnerName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-foreground truncate">{th.partnerName}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTimeBerlin(time)}
                    </span>
                  </div>
                  {lastMsg && (
                    <p className="truncate text-xs text-muted-foreground">
                      {lastMsg.sender === "user" ? "Du: " : ""}
                      {lastMsg.text}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    }>
      <MessagesPageContent />
    </Suspense>
  )
}

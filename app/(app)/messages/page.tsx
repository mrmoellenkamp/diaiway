"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, Send, MessageSquare, Bell, Calendar, CheckCircle2, XCircle, MessageCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useI18n } from "@/lib/i18n"
import { useApp } from "@/lib/app-context"
import { formatTimeBerlin } from "@/lib/date-utils"
import { toast } from "sonner"

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
}

export default function MessagesPage() {
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
    if (!text || !activeThread || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUserId: activeThread, text }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, { id: data.id, text: data.text, sender: "user", timestamp: data.timestamp }])
        setInput("")
        fetchThreads()
      } else {
        toast.error(data.error || "Fehler")
      }
    } catch {
      toast.error("Fehler")
    } finally {
      setSending(false)
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

  // Thread detail view
  if (activeThread && thread) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background pb-16">
        <div className="flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur-md px-4 py-3">
          <button onClick={() => setActiveThread(null)} className="flex size-8 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="size-4" />
          </button>
          <Avatar className="size-9 border border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {thread.partnerAvatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {thread.expertId ? (
                <Link href={`/takumi/${thread.expertId}`} className="underline-offset-2 hover:underline">
                  {thread.partnerName}
                </Link>
              ) : (
                thread.partnerName
              )}
            </p>
            {thread.subcategory ? (
              <p className="text-[11px] text-muted-foreground">{thread.subcategory}</p>
            ) : null}
          </div>
          {thread.expertId && (
            <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs">
              <Link href={`/takumi/${thread.expertId}`}>{t("common.profile")}</Link>
            </Button>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4 scrollbar-none">
          {loadingMessages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed",
                    msg.sender === "user"
                      ? "rounded-tr-md bg-primary/10 text-foreground"
                      : "rounded-tl-md border border-border/40 bg-white/80 text-foreground shadow-sm"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border bg-card/95 px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("messages.placeholder")}
              className="h-10 rounded-xl bg-muted/50 text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              size="icon"
              className="size-10 shrink-0 rounded-xl bg-primary hover:bg-primary/90"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
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

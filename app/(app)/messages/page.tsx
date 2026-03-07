"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/app-context"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowLeft, Send, MessageSquare, Bell, Calendar, CheckCircle2, XCircle, MessageCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useI18n } from "@/lib/i18n"
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

export default function MessagesPage() {
  const { dmThreads, sendDirectMessage, totalUnread, refreshNotificationCount } = useApp()
  const { t } = useI18n()
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.notifications && setNotifications(data.notifications))
      .catch(() => {})
  }, [])

  const thread = dmThreads.find((t) => t.takumiId === activeThread)

  function handleSend() {
    if (!input.trim() || !thread) return
    sendDirectMessage(
      thread.takumiId,
      thread.takumiName,
      thread.takumiAvatar,
      thread.subcategory,
      input.trim()
    )
    setInput("")
  }

  // Thread detail view
  if (activeThread && thread) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background pb-16">
        {/* Thread Header */}
        <div className="flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur-md px-4 py-3">
          <button onClick={() => setActiveThread(null)} className="flex size-8 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="size-4" />
          </button>
          <Avatar className="size-9 border border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {thread.takumiAvatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{thread.takumiName}</p>
            <p className="text-[11px] text-muted-foreground">{thread.subcategory}</p>
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs">
            <Link href={`/takumi/${thread.takumiId}`}>{t("common.profile")}</Link>
          </Button>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4 scrollbar-none">
          {thread.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.sender === "user" ? "justify-end" : "justify-start"
              )}
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
          ))}
        </div>

        {/* Input */}
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
              disabled={!input.trim()}
              size="icon"
              className="size-10 shrink-0 rounded-xl bg-primary hover:bg-primary/90"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const unreadNotifications = notifications.filter((n) => !n.read)

  const markAsRead = (ids: string[]) => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => {
        if (r.ok) {
          setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)))
          refreshNotificationCount?.()
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
        refreshNotificationCount?.()
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
    if (type === "booking_question") return <MessageCircle className="size-4" />
    return <Bell className="size-4" />
  }

  // Thread list view
  return (
    <PageContainer>
      {unreadNotifications.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t("messages.bookingAlerts")}</h3>
          {unreadNotifications.slice(0, 10).map((n) => (
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
                    {actingId === n.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
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
      {dmThreads.length === 0 && unreadNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <MessageSquare className="size-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("messages.empty")}</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("messages.emptyDesc")}
          </p>
          <Button asChild className="mt-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/categories">{t("messages.discoverCategories")}</Link>
          </Button>
        </div>
      ) : dmThreads.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          {dmThreads.map((t) => {
            const lastMsg = t.messages[t.messages.length - 1]
            const time = new Date(lastMsg.timestamp)
            return (
              <button
                key={t.takumiId}
                onClick={() => setActiveThread(t.takumiId)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="relative">
                  <Avatar className="size-11 border border-primary/10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {t.takumiAvatar}
                    </AvatarFallback>
                  </Avatar>
                  {t.unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                      {t.unread}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t.takumiName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {time.getHours().toString().padStart(2, "0")}:
                      {time.getMinutes().toString().padStart(2, "0")}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {lastMsg.sender === "user" ? "Du: " : ""}
                    {lastMsg.text}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}

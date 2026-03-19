"use client"

import { useState, useEffect, useCallback, Suspense, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { MessageSquare, Bell, Calendar, CheckCircle2, XCircle, MessageCircle, Loader2, Mail, Building2, MailOpen, MessageSquareDashed, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useI18n } from "@/lib/i18n"
import { useApp } from "@/lib/app-context"
import { formatTimeBerlin } from "@/lib/date-utils"
import { toast } from "sonner"
import { UserChatBox } from "@/components/user-chat-box"
import { VerifiedBadge } from "@/components/verified-badge"
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
  partnerImageUrl?: string | null
  partnerIsVerified?: boolean
  subcategory: string
  expertId: string | null
  isOnline?: boolean
  lastMessage: { text: string; sender: string; timestamp: number } | null
  unread: number
}

function MessagesPageContent() {
  const { t } = useI18n()
  const { data: session } = useSession()
  const { refreshNotificationCount } = useApp()
  const searchParams = useSearchParams()
  const withParam = searchParams.get("with")

  const [threads, setThreads] = useState<ThreadInfo[]>([])
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [actingId, setActingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"notifications" | "chats" | "waymails">("chats")
  const [waymailFolder, setWaymailFolder] = useState<"inbox" | "sent">("inbox")
  const [waymails, setWaymails] = useState<Array<{
    id: string
    folder?: "inbox" | "sent"
    senderName?: string
    senderImageUrl?: string | null
    recipientName?: string
    recipientImageUrl?: string | null
    subject: string
    textPreview: string
    timestamp: number
    read: boolean
    isSystemWaymail?: boolean
  }>>([])
  const [loadingWaymails, setLoadingWaymails] = useState(false)
  const [selectedWaymailId, setSelectedWaymailId] = useState<string | null>(null)
  const [waymailDetail, setWaymailDetail] = useState<{
    id: string
    senderName?: string
    recipientName?: string
    isFromMe?: boolean
    subject: string | null
    text: string
    attachmentUrl?: string | null
    read?: boolean
  } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "notification" | "waymail" | "chat"; id: string } | null>(null)
  const redirectingRef = useRef(false)

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
          refreshNotificationCount?.()
        }
      })
      .catch(() => {})
  }

  async function doDeleteNotification(id: string) {
    try {
      const r = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
      if (r.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        refreshNotificationCount?.()
        toast.success(t("messages.notificationDeleted"))
      }
    } catch {
      toast.error(t("common.networkError"))
    }
  }

  async function doDeleteWaymail(id: string) {
    try {
      const r = await fetch(`/api/messages?waymail=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (r.ok) {
        setWaymails((prev) => prev.filter((w) => w.id !== id))
        if (selectedWaymailId === id) {
          setSelectedWaymailId(null)
          setWaymailDetail(null)
        }
        refreshNotificationCount?.()
        toast.success(t("messages.waymailDeleted"))
      } else {
        const data = await r.json().catch(() => ({}))
        toast.error(data.error ?? t("common.networkError"))
      }
    } catch {
      toast.error(t("common.networkError"))
    }
  }

  async function doDeleteChatThread(partnerId: string) {
    try {
      const r = await fetch(`/api/messages?thread=${encodeURIComponent(partnerId)}`, { method: "DELETE" })
      if (r.ok) {
        setThreads((prev) => prev.filter((th) => th.partnerId !== partnerId))
        if (activeThread === partnerId) setActiveThread(null)
        refreshNotificationCount?.()
        toast.success(t("messages.chatDeleted"))
      } else {
        const data = await r.json().catch(() => ({}))
        toast.error(data.error ?? t("common.networkError"))
      }
    } catch {
      toast.error(t("common.networkError"))
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    const { type, id } = deleteConfirm
    setDeleteConfirm(null)
    if (type === "notification") await doDeleteNotification(id)
    else if (type === "waymail") await doDeleteWaymail(id)
    else if (type === "chat") await doDeleteChatThread(id)
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
        toast.error(data.error || t("common.error"))
      }
    } catch {
      toast.error(t("common.error"))
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

  // Beim ersten Laden: URL-Params (with, waymail) setzen
  // Wenn with=eingeloggter Nutzer → Empfänger hat Link geklickt, aber Absender ist eingeloggt → Abmelden
  useEffect(() => {
    if (withParam && session?.user?.id && withParam === session.user.id && !redirectingRef.current) {
      redirectingRef.current = true
      const callbackUrl = `/messages?with=${encodeURIComponent(withParam)}`
      // Direkt zur Login-Seite – kein signOut nötig, die neue Session ersetzt die alte
      window.location.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
      return
    }
    if (withParam && threads.length > 0 && !activeThread) {
      setActiveThread(withParam)
      setActiveTab("chats")
    }
  }, [withParam, threads, activeThread, session?.user?.id])

  const waymailParam = searchParams.get("waymail")
  useEffect(() => {
    if (waymailParam && !redirectingRef.current) {
      setActiveTab("waymails")
      setSelectedWaymailId(waymailParam)
      fetch(`/api/messages?waymail=${encodeURIComponent(waymailParam)}`)
        .then(async (r) => {
          const d = await r.json()
          const callbackUrl = `/messages?waymail=${encodeURIComponent(waymailParam)}`

          if (r.status === 401 || r.status === 403 || r.status === 404) {
            // Waymail gehört nicht dem eingeloggten Nutzer → Login als richtiger Empfänger
            redirectingRef.current = true
            window.location.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
            return
          }
          if (!r.ok) {
            // Server-Fehler → nicht ausloggen, nur silent fail
            return
          }

          // Der E-Mail-Benachrichtigungslink ist ausschließlich für den EMPFÄNGER gedacht.
          // Falls der eingeloggte Nutzer der Absender ist (isFromMe === true), bedeutet das,
          // dass ein anderer User eingeloggt ist → ausloggen und als Empfänger neu anmelden.
          if (d.isFromMe) {
            redirectingRef.current = true
            window.location.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
            return
          }

          setWaymailFolder("inbox")
          setWaymailDetail(d)
          const alreadyRead = d.read === true || waymails.find((x) => x.id === waymailParam)?.read
          if (!alreadyRead) {
            fetch(`/api/messages?waymail=${encodeURIComponent(waymailParam)}`, { method: "PATCH" })
              .then((r) => r.ok && refreshNotificationCount?.())
              .catch(() => {})
            setWaymails((prev) => prev.map((x) => (x.id === waymailParam ? { ...x, read: true } : x)))
          }
        })
        .catch(() => setWaymailDetail(null))
    }
  }, [waymailParam])

  const fetchWaymails = useCallback(async () => {
    setLoadingWaymails(true)
    const type = waymailFolder === "sent" ? "waymail-sent" : "waymail"
    const r = await fetch(`/api/messages?type=${type}`)
    if (r.ok) {
      const data = await r.json()
      setWaymails(data.waymails ?? [])
    }
    setLoadingWaymails(false)
  }, [waymailFolder])

  useEffect(() => {
    if (activeTab === "waymails") {
      // Beim Deep-Link (waymailParam) NICHT zurücksetzen – der waymailParam-Effect
      // hat bereits selectedWaymailId gesetzt; Löschen passiert nur bei manuellem Tab-Klick
      if (!waymailParam) {
        setSelectedWaymailId(null)
        setWaymailDetail(null)
      }
      fetchWaymails()
    }
  }, [activeTab, waymailFolder, fetchWaymails, waymailParam])

  // Postfach: E-Mail-Browser-Layout — Benachrichtigungen + Chats getrennt
  return (
    <PageContainer>
      {/* Tabs: Benachrichtigungen | Chats | Waymails */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("notifications")}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "notifications"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("messages.tabNotifications")}
          {unreadNotifications.length > 0 && (
            <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
              {unreadNotifications.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("chats")}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "chats"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("messages.tabChats")}
        </button>
        <button
          onClick={() => {
            // Manueller Klick → Auswahl immer zurücksetzen (zeigt Listenansicht)
            setSelectedWaymailId(null)
            setWaymailDetail(null)
            setActiveTab("waymails")
          }}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "waymails"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("messages.tabWaymails")}
        </button>
      </div>

      {/* Benachrichtigungen — E-Mail-ähnliche Liste */}
      {activeTab === "notifications" && (
        <div className="flex flex-col gap-1">
          {loadingThreads ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-8 text-center">
              <Bell className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-card/50">
              {notifications.slice(0, 50).map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    markAsRead([n.id])
                    if (n.bookingId && n.type === "booking_request") {
                      window.location.href = `/booking/respond/${n.bookingId}`
                    } else if (n.bookingId) {
                      window.location.href = `/sessions`
                    } else if (n.type === "new_message") {
                      setActiveTab("chats")
                      setActiveThread(null) // Wird ggf. durch Deep-Link gesetzt
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLElement).click()}
                  className={cn(
                    "flex items-start gap-3 border-b border-border/40 px-3 py-3 text-left last:border-0 hover:bg-muted/30",
                    !n.read && "bg-accent/5"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <NotificationIcon type={n.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {new Date(n.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "notification", id: n.id }) }}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    {n.type === "booking_request" && n.bookingId && (
                      <>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleBookingAction(n.bookingId!, "confirmed", n.id)}
                          disabled={actingId === n.id}
                        >
                          {actingId === n.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                          {t("messages.bookingConfirm")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-destructive/30 text-destructive"
                          onClick={() => handleBookingAction(n.bookingId!, "declined", n.id)}
                          disabled={actingId === n.id}
                        >
                          {t("messages.bookingDecline")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Waymails — Posteingang | Postausgang */}
      {activeTab === "waymails" && (
        <div className="flex flex-col gap-1">
          <div className="mb-2 flex gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
            <button
              onClick={() => { setWaymailFolder("inbox"); setSelectedWaymailId(null); setWaymailDetail(null) }}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                waymailFolder === "inbox"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("messages.waymailInbox")}
            </button>
            <button
              onClick={() => { setWaymailFolder("sent"); setSelectedWaymailId(null); setWaymailDetail(null) }}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                waymailFolder === "sent"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("messages.waymailSent")}
            </button>
          </div>
          {selectedWaymailId && waymailDetail ? (
            <div className="rounded-xl border border-border/60 bg-card/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => { setSelectedWaymailId(null); setWaymailDetail(null) }}
                  className="text-sm text-primary hover:underline"
                >
                  ← {t("common.back")}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "waymail", id: waymailDetail.id }) }}
                  aria-label={t("common.delete")}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {waymailDetail.isFromMe
                  ? `${t("messages.waymailTo")}: ${waymailDetail.recipientName ?? ""}`
                  : `${t("messages.waymailFrom")}: ${waymailDetail.senderName ?? ""}`}
              </p>
              <h2 className="mt-1 text-lg font-bold text-foreground">{waymailDetail.subject || "(ohne Betreff)"}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{waymailDetail.text}</p>
              {waymailDetail.attachmentUrl && (
                <a href={waymailDetail.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  📎 Anhang öffnen
                </a>
              )}
            </div>
          ) : loadingWaymails ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : waymails.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <MailOpen className="size-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {waymailFolder === "sent" ? t("messages.waymailSentEmpty") : t("messages.waymailEmpty")}
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                {waymailFolder === "sent" ? t("messages.waymailSentEmptyDesc") : t("messages.waymailEmptyDesc")}
              </p>
              {waymailFolder === "inbox" && (
                <Button asChild className="mt-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/takumis">{t("messages.findExperts")}</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-card/50">
              {waymails.map((wm) => (
                <div
                  key={wm.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedWaymailId(wm.id)
                    fetch(`/api/messages?waymail=${encodeURIComponent(wm.id)}`)
                      .then((r) => r.json())
                      .then((d) => {
                        if (d.error) return
                        setWaymailDetail(d)
                        if (!wm.read && waymailFolder === "inbox") {
                          fetch(`/api/messages?waymail=${encodeURIComponent(wm.id)}`, { method: "PATCH" })
                            .then((r) => r.ok && refreshNotificationCount?.())
                            .catch(() => {})
                          setWaymails((prev) => prev.map((w) => (w.id === wm.id ? { ...w, read: true } : w)))
                        }
                      })
                      .catch(() => setWaymailDetail(null))
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLElement).click()}
                  className="flex items-start gap-3 border-b border-border/40 px-3 py-3 text-left last:border-0 hover:bg-muted/30"
                >
                  {waymailFolder === "inbox" && wm.isSystemWaymail ? (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" title="diAiway System">
                      <Building2 className="size-5" />
                    </div>
                  ) : (
                    <Avatar className="size-10 shrink-0">
                      {waymailFolder === "sent"
                        ? (wm.recipientImageUrl ? <AvatarImage src={wm.recipientImageUrl} alt={wm.recipientName} /> : null)
                        : (wm.senderImageUrl ? <AvatarImage src={wm.senderImageUrl} alt={wm.senderName} /> : null)}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {(waymailFolder === "sent" ? wm.recipientName : wm.senderName)?.slice(0, 2).toUpperCase() ?? "??"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    {!wm.read && (
                      <span className="mt-1.5 shrink-0 flex size-2 rounded-full bg-blue-500" aria-hidden title="Ungelesen" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{wm.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">{wm.textPreview}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {new Date(wm.timestamp).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "waymail", id: wm.id }) }}
                      aria-label={t("common.delete")}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chats — Thread-Liste + Chat-Box (öffnet sich inline / als Drawer) */}
      {activeTab === "chats" && (
        <div className="flex flex-col gap-4">
          {loadingThreads ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquareDashed className="size-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{t("messages.empty")}</h2>
              <p className="max-w-xs text-sm text-muted-foreground">{t("messages.emptyDesc")}</p>
              <Button asChild className="mt-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/takumis">{t("messages.findExperts")}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-card/50">
                {threads.map((th) => {
                  const lastMsg = th.lastMessage
                  const time = lastMsg ? new Date(lastMsg.timestamp) : new Date()
                  const isActive = th.partnerId === activeThread
                  return (
                    <div
                      key={th.partnerId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveThread(th.partnerId)}
                      onKeyDown={(e) => e.key === "Enter" && setActiveThread(th.partnerId)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/30 cursor-pointer",
                        isActive && "bg-primary/5 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="size-11 border border-primary/10">
                          {th.partnerImageUrl ? <AvatarImage src={th.partnerImageUrl} alt={th.partnerName} /> : null}
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0 min-h-0">
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
                            {th.partnerIsVerified && <VerifiedBadge size="sm" className="shrink-0" />}
                          </div>
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
                      <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "chat", id: th.partnerId }) }}
                          aria-label={t("common.delete")}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Chat-Box öffnet sich unter der Liste (keine separate Seite) */}
              {activeThread && thread && (
                <UserChatBox
                  partnerId={thread.partnerId}
                  partnerName={thread.partnerName}
                  partnerAvatar={thread.partnerAvatar}
                  partnerImageUrl={thread.partnerImageUrl}
                  partnerIsVerified={thread.partnerIsVerified}
                  expertId={thread.expertId}
                  subcategory={thread.subcategory}
                  onClose={() => setActiveThread(null)}
                  inline
                  onMessagesLoaded={refreshNotificationCount}
                />
              )}
            </>
          )}
        </div>
      )}
      <div className="scroll-end-spacer" aria-hidden />

      {/* Lösch-Bestätigung */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === "notification" && t("messages.deleteNotificationConfirm")}
              {deleteConfirm?.type === "waymail" && t("messages.deleteWaymailConfirm")}
              {deleteConfirm?.type === "chat" && t("messages.deleteChatConfirm")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "notification" && t("messages.deleteNotificationConfirmDesc")}
              {deleteConfirm?.type === "waymail" && t("messages.deleteWaymailConfirmDesc")}
              {deleteConfirm?.type === "chat" && t("messages.deleteChatConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

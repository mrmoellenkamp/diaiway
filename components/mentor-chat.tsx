"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { UIMessage } from "ai"
import {
  Send,
  Paperclip,
  Bot,
  User,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Video,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useApp } from "@/lib/app-context"
import { useTakumis } from "@/hooks/use-takumis"
import { useI18n } from "@/lib/i18n"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DiAiwayBrand } from "@/components/diaiway-brand"

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function hasTakumiTip(msg: UIMessage): boolean {
  return getMessageText(msg).includes("[TAKUMI_TIP]")
}

function cleanText(text: string): string {
  return text.replace(/\[TAKUMI_TIP\]/g, "").trim()
}

async function convertFilesToDataURLs(
  files: FileList
): Promise<Array<{ type: "file"; mediaType: string; url: string }>> {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<{ type: "file"; mediaType: string; url: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              type: "file",
              mediaType: file.type,
              url: reader.result as string,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
    )
  )
}

interface MentorChatProps {
  variant: "embedded" | "floating" | "fullpage"
  className?: string
  /** Kein eigener Header (z. B. in CollapsibleAiBox, Oberzeile ist der Header) */
  hideHeader?: boolean
}

export function MentorChat({ variant, className, hideHeader = false }: MentorChatProps) {
  const {
    storedMessages,
    setStoredMessages,
    pendingMentorMessage,
    setPendingMentorMessage,
    viewingTakumiId,
    isSearchingExperts,
    setIsSearchingExperts,
    searchResults,
    setSearchResults,
    userAvatar,
  } = useApp()
  const { takumis } = useTakumis()
  const { locale, t } = useI18n()
  const localeRef = useRef(locale)
  localeRef.current = locale
  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ locale: localeRef.current }),
      }),
    []
  )
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingHandled = useRef(false)
  const proactiveShown = useRef(false)
  const [showProactivePrompt, setShowProactivePrompt] = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [pendingImageParts, setPendingImageParts] = useState<Array<{ type: "file"; mediaType: string; url: string }>>(
    []
  )
  const [imageCaption, setImageCaption] = useState("")
  const router = useRouter()
  const isEmbedded = variant === "embedded"
  const isFullpage = variant === "fullpage"

  const liveTakumi =
    (viewingTakumiId ? takumis.find((t) => t.id === viewingTakumiId) : null) ||
    takumis.find((t) => t.isLive) ||
    takumis[0]

  const { messages, sendMessage, status, error } = useChat({
    id: "diaiway-mentor",
    transport: chatTransport,
    messages: storedMessages.length > 0 ? storedMessages : undefined,
  })

  const isStreaming = status === "streaming" || status === "submitted"
  const hasError = status === "error"

  // Proactive prompt: show after 3 user messages
  const userMsgCount = messages.filter((m) => m.role === "user").length
  useEffect(() => {
    if (userMsgCount >= 3 && !proactiveShown.current && !isStreaming) {
      proactiveShown.current = true
      setShowProactivePrompt(true)
    }
  }, [userMsgCount, isStreaming])

  // Auto-send pending message
  useEffect(() => {
    if (pendingMentorMessage && !pendingHandled.current && status === "ready") {
      pendingHandled.current = true
      sendMessage({ text: pendingMentorMessage })
      setPendingMentorMessage(null)
    }
    if (!pendingMentorMessage) pendingHandled.current = false
  }, [pendingMentorMessage, status, sendMessage, setPendingMentorMessage])

  // Sync messages to context
  const prevLengthRef = useRef(messages.length)
  useEffect(() => {
    if (messages.length > 0 && messages.length !== prevLengthRef.current) {
      prevLengthRef.current = messages.length
      setStoredMessages(messages)
    }
  }, [messages, setStoredMessages])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isStreaming, isSearchingExperts, showProactivePrompt])

  // Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    sendMessage({ text: input.trim() })
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }, [input, isStreaming, sendMessage])

  function handleSearchExperts() {
    setShowProactivePrompt(false)
    setIsSearchingExperts(true)
    // Simulate search delay
    setTimeout(() => {
      const live = takumis.filter((t) => t.isLive).map((t) => t.id)
      const others = takumis.filter((t) => !t.isLive).slice(0, 2).map((t) => t.id)
      setSearchResults([...live.slice(0, 3), ...others.slice(0, 1)])
      setIsSearchingExperts(false)
    }, 2800)
  }

  function handleDeclineSearch() {
    setShowProactivePrompt(false)
    sendMessage({ text: t("mentor.declineSearch") })
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (isStreaming) return
    try {
      const fileParts = await convertFilesToDataURLs(files)
      setPendingImageParts(fileParts)
      setImageCaption("")
      setImageDialogOpen(true)
    } finally {
      e.target.value = ""
    }
  }

  function sendPendingImages() {
    if (pendingImageParts.length === 0 || isStreaming) return
    const caption = imageCaption.trim()
    const textPart = caption || t("mentor.imageNoCaptionBody")
    // AI SDK 5: Anhänge über `files` (FileUIPart[]), nicht über manuelles `parts` + `role`
    sendMessage({
      text: textPart,
      files: pendingImageParts.map((p, i) => ({
        type: "file" as const,
        mediaType: p.mediaType,
        url: p.url,
        filename: p.mediaType.startsWith("image/") ? `image-${i + 1}` : `file-${i + 1}`,
      })),
    })
    setImageDialogOpen(false)
    setPendingImageParts([])
    setImageCaption("")
  }

  function cancelPendingImages() {
    setImageDialogOpen(false)
    setPendingImageParts([])
    setImageCaption("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Resolve search result Takumi objects (filter out IDs that no longer exist)
  const matchedTakumis = searchResults
    ? searchResults
        .map((id) => takumis.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => !!t)
    : []

  return (
    <>
    <Dialog open={imageDialogOpen} onOpenChange={(o) => !o && cancelPendingImages()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("mentor.imageAttachTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("mentor.imageCaptionHint")}</p>
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
          {pendingImageParts.map((p, i) =>
            p.mediaType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p.url}
                alt=""
                className="h-20 w-20 rounded-lg border border-border object-cover"
              />
            ) : null
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mentor-image-caption" className="text-xs">
            {t("mentor.imageCaptionLabel")}
          </Label>
          <textarea
            id="mentor-image-caption"
            value={imageCaption}
            onChange={(e) => setImageCaption(e.target.value)}
            placeholder={t("mentor.imageCaptionPlaceholder")}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={cancelPendingImages}>
            {t("mentor.cancelAttach")}
          </Button>
          <Button type="button" onClick={sendPendingImages} disabled={isStreaming}>
            {t("mentor.sendWithImage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div
      className={cn(
        "flex flex-col overflow-hidden font-sans",
        isEmbedded
          ? "rounded-3xl border border-primary/15 bg-emerald-50/50 backdrop-blur-md shadow-lg shadow-primary/10"
          : isFullpage
            ? "h-[calc(100vh-6rem)] rounded-3xl border border-primary/15 bg-emerald-50/50 backdrop-blur-md shadow-lg shadow-primary/10"
            : "h-full rounded-3xl border border-primary/15 bg-emerald-50/50 backdrop-blur-md shadow-lg shadow-primary/10",
        className
      )}
    >
      {/* Header — einheitlich dunkelgrün (wie CollapsibleAiBox / Marketing) */}
      {!hideHeader && (
        <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-br from-primary via-primary to-primary/95 px-4 py-3 shadow-[0_4px_20px_rgba(6,78,59,0.25)]">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/10">
            <Sparkles className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1 text-sm font-bold text-primary-foreground leading-tight">
              <span className="font-semibold">{t("mentor.hishoName")}</span>
              <span className="text-primary-foreground/60">–</span>
              <DiAiwayBrand lightOnDark />
              <span className="text-primary-foreground/60">–</span>
              <span className="text-[11px] font-semibold text-primary-foreground/90">
                {t("mentor.intelligenceSuffix")}
              </span>
            </p>
            <p className="truncate text-[10px] text-primary-foreground/65">
              {(isEmbedded || isFullpage) ? t("mentor.headerDescEmbedded") : t("mentor.headerDescFloating")}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-accent">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-accent" />
              <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
            </span>
            {t("mentor.online")}
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className={cn(
          "flex flex-1 flex-col gap-3 overflow-y-auto p-4 scrollbar-none",
          isEmbedded && !isFullpage ? "min-h-[180px] max-h-[260px]" : "min-h-0"
        )}
      >
        {/* Welcome */}
        {messages.length === 0 && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
              <Bot className="size-3.5 text-primary" />
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-border/30 bg-white/80 px-3 py-2.5 text-[13px] leading-relaxed text-foreground shadow-sm">
              {t("mentor.welcome")}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const showTakumiTip = msg.role === "assistant" && hasTakumiTip(msg)

          return (
            <div key={msg.id}>
              <div className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                <div
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full",
                    msg.role === "assistant" ? "bg-primary/10 ring-1 ring-primary/10" : "bg-accent/10 ring-1 ring-accent/10"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="size-3.5 text-primary" />
                  ) : userAvatar?.trim() ? (
                    <Image
                      src={userAvatar.trim()}
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
                    "max-w-[85%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed",
                    msg.role === "assistant"
                      ? "rounded-tl-md bg-white/80 text-foreground shadow-sm border border-border/30"
                      : "rounded-tr-md bg-primary/10 text-foreground"
                  )}
                >
                  <div className="flex flex-col gap-2">
                    {msg.parts.map((part, idx) => {
                      if (part.type === "text") {
                        const cleaned = cleanText(part.text)
                        if (!cleaned) return null
                        return (
                          <span key={idx} className="whitespace-pre-wrap">
                            {cleaned}
                          </span>
                        )
                      }
                      if (
                        part.type === "file" &&
                        part.mediaType?.startsWith("image/")
                      ) {
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={idx}
                            src={part.url}
                            alt={part.filename ?? t("mentor.attachPhoto")}
                            className="max-h-40 max-w-full rounded-lg border border-border/40 object-contain"
                          />
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              </div>

              {/* Takumi Tip Card */}
              {showTakumiTip && (
                <div className="ml-9 mt-2.5 overflow-hidden rounded-xl border border-accent/20 bg-white/70 shadow-sm">
                  <div className="border-b border-accent/10 bg-accent/[0.06] px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="size-3 text-accent" />
                      <span className="font-jp text-[9px] text-accent/60">{"提案"}</span>
                      <span className="text-[10px] font-bold text-foreground">KI-Tipp: Experten-Check</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 p-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-9 ring-2 ring-accent/20">
                        {liveTakumi.imageUrl && <AvatarImage src={liveTakumi.imageUrl} alt={liveTakumi.name} className="object-cover" />}
                        <AvatarFallback className="bg-accent/10 text-accent text-xs font-bold">{liveTakumi.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground">{liveTakumi.name}</p>
                        <p className="text-[10px] text-muted-foreground">{liveTakumi.subcategory}</p>
                      </div>
                      {liveTakumi.isLive && (
                        <span className="flex items-center gap-1 text-[9px] font-medium text-accent">
                          <span className="relative flex size-1.5">
                            <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-accent" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
                          </span>
                          Live
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-accent/5 px-2.5 py-1.5">
                      <CheckCircle2 className="size-3 shrink-0 text-accent" />
                      <p className="text-[10px] text-muted-foreground">5 Min. gratis. Kein Abo.</p>
                    </div>
                    <Button
                      onClick={() => router.push(`/takumi/${liveTakumi.id}`)}
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl bg-accent text-xs font-bold text-accent-foreground shadow-md shadow-accent/15 hover:bg-accent/90"
                    >
                      <Video className="size-3.5" />
                      Experten-Check starten
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Proactive prompt -- ask user if they want expert search */}
        {showProactivePrompt && !isSearchingExperts && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
              <Sparkles className="size-3.5 text-primary" />
            </div>
            <div className="max-w-[90%] flex flex-col gap-2.5 rounded-2xl rounded-tl-md border border-primary/15 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-sm">
              <p className="text-[13px] leading-relaxed text-foreground">{t("mentor.proactiveSearchQuestion")}</p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSearchExperts}
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="size-3" />
                  {t("mentor.proactiveSearchYes")}
                </Button>
                <Button
                  onClick={handleDeclineSearch}
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-[11px] border-border/50"
                >
                  {t("mentor.proactiveSearchNo")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Emerald search animation */}
        {isSearchingExperts && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative">
              <div className="search-pulse-ring absolute inset-0 rounded-full" />
              <div className="search-pulse-ring-delayed absolute inset-0 rounded-full" />
              <div className="relative flex size-16 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
                <Sparkles className="size-6 text-primary-foreground" />
              </div>
            </div>
            <p className="font-jp text-sm font-medium text-primary/70">
              {"最適なマッチを探しています"}
            </p>
            <p className="text-[12px] text-muted-foreground">Suche nach dem perfekten Match...</p>
          </div>
        )}

        {/* Search Results: Horizontal swipeable Takumi cards */}
        {matchedTakumis.length > 0 && !isSearchingExperts && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 ml-9">
              <Sparkles className="size-3 text-accent" />
              <span className="text-[11px] font-semibold text-foreground">
                {matchedTakumis.length} passende Experten gefunden
              </span>
              <button onClick={() => setSearchResults(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {matchedTakumis.map((t) => {
                const matchRate = Math.floor(75 + Math.random() * 20)
                return (
                  <div
                    key={t.id}
                    className="flex w-[200px] shrink-0 flex-col gap-2.5 rounded-xl border border-primary/10 bg-white/70 p-3 shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-10 ring-2 ring-primary/10">
                        {t.imageUrl && <AvatarImage src={t.imageUrl} alt={t.name} className="object-cover" />}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {t.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-jp text-[12px] font-semibold text-foreground truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.subcategory}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${matchRate}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-accent">{matchRate}%</span>
                      </div>
                      {t.isLive && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium text-accent">
                          <span className="size-1.5 rounded-full bg-accent animate-live-pulse" />
                          Live
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => router.push(`/takumi/${t.id}`)}
                      size="sm"
                      className="h-8 w-full rounded-lg bg-primary/90 text-[11px] font-semibold text-primary-foreground hover:bg-primary"
                    >
                      Profil ansehen
                      <ArrowRight className="ml-1 size-3" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10 animate-live-pulse">
              <Bot className="size-3.5 text-primary" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border/30 bg-white/80 px-3 py-2.5 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="block size-1.5 rounded-full bg-primary/50 animate-mentor-dot-1" />
                <span className="block size-1.5 rounded-full bg-primary/50 animate-mentor-dot-2" />
                <span className="block size-1.5 rounded-full bg-primary/50 animate-mentor-dot-3" />
              </div>
              <span className="text-[10px] text-muted-foreground">{t("mentor.thinking")}</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/10">
              <Sparkles className="size-3.5 text-destructive" />
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-[12px] leading-relaxed text-foreground shadow-sm">
              <p className="font-semibold text-destructive">Verbindungsfehler</p>
              <p className="mt-1 text-muted-foreground text-[11px] break-words">
                {error?.message || "Bitte versuche es erneut."}
              </p>
              <button
                onClick={() => input.trim() ? handleSend() : setInput("Hallo")}
                className="mt-1.5 text-[10px] font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Erneut versuchen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="border-t border-primary/8 bg-white/40 px-3 py-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-border/40 bg-white/70 px-2.5 py-1.5">
          <label
            className={cn(
              "relative mb-0.5 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary touch-manipulation",
              isStreaming && "pointer-events-none opacity-40"
            )}
            aria-label={t("mentor.attachPhoto")}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={handleFileSelect}
              disabled={isStreaming}
            />
            <Paperclip className="size-3.5 pointer-events-none" />
          </label>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={(isEmbedded || isFullpage) ? t("mentor.placeholderEmbedded") : t("mentor.placeholderFloating")}
            rows={1}
            className="min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
            style={{ maxHeight: 160 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={cn(
              "mb-0.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition-all touch-manipulation",
              input.trim() && !isStreaming
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "text-muted-foreground/25"
            )}
            aria-label="Nachricht senden"
          >
            <Send className="size-3.5" />
          </button>
        </div>
        <p className="mt-1 text-center text-[9px] text-muted-foreground/30">
          Shift+Enter fur neue Zeile
        </p>
      </div>
    </div>
    </>
  )
}

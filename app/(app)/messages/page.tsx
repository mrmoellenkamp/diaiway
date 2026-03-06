"use client"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Send, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useI18n } from "@/lib/i18n"

export default function MessagesPage() {
  const { dmThreads, sendDirectMessage, totalUnread } = useApp()
  const { t } = useI18n()
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [input, setInput] = useState("")

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
            <Link href={`/takumi/${thread.takumiId}`}>Profil</Link>
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
              placeholder="Nachricht schreiben..."
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

  // Thread list view
  return (
    <PageContainer>
      {dmThreads.length === 0 ? (
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
      ) : (
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

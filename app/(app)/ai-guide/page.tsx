"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageContainer } from "@/components/page-container"
import { TakumiCard } from "@/components/takumi-card"
import { useTakumis } from "@/hooks/use-takumis"
import { useI18n } from "@/lib/i18n"
import { Camera, Image as ImageIcon, Send, Sparkles } from "lucide-react"
import type { AiMessage } from "@/lib/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function AiGuidePage() {
  const { t } = useI18n()
  const { takumis, isEmpty } = useTakumis()
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("aiGuide.welcome"),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  function findMatchingTakumis(text: string) {
    if (isEmpty || takumis.length === 0) return []
    const lower = text.toLowerCase()
    const keywords = lower.split(/\s+/).filter((w) => w.length > 2)

    const scored = takumis.map((tk) => {
      const haystack = `${tk.categoryName} ${tk.subcategory} ${tk.bio} ${tk.name}`.toLowerCase()
      let score = 0
      for (const kw of keywords) {
        if (haystack.includes(kw)) score += 1
      }
      if (tk.isLive) score += 0.5
      return { takumi: tk, score }
    })

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.takumi)
  }

  function getResponse(userText: string) {
    const matches = findMatchingTakumis(userText)
    if (matches.length > 0) {
      return {
        text: t("aiGuide.foundExperts").replace("{count}", String(matches.length)),
        takumiIds: matches.map((m) => m.id),
      }
    }
    if (isEmpty) {
      return {
        text: t("aiGuide.noExpertsYet"),
        takumiIds: [],
      }
    }
    const topRated = [...takumis].sort((a, b) => b.rating - a.rating).slice(0, 3)
    return {
      text: t("aiGuide.noExactMatch"),
      takumiIds: topRated.map((tk) => tk.id),
    }
  }

  function sendMessage() {
    if (!input.trim()) return
    const userMsg: AiMessage = { id: `u${Date.now()}`, role: "user", content: input }
    setMessages((prev) => [...prev, userMsg])
    const currentInput = input
    setInput("")
    setIsTyping(true)

    const response = getResponse(currentInput)
    setTimeout(() => {
      const aiMsg: AiMessage = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: response.text,
        suggestions: response.takumiIds.map((id) => {
          const tk = takumis.find((t) => t.id === id)
          return tk
            ? { takumiId: id, name: tk.name, match: Math.round(70 + Math.random() * 25), reason: tk.subcategory }
            : null
        }).filter(Boolean) as AiMessage["suggestions"],
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 1000)
  }

  function handlePhotoUpload() {
    const userMsg: AiMessage = {
      id: `u${Date.now()}`,
      role: "user",
      content: t("aiGuide.photoUploaded"),
      image: "photo",
    }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    const response = isEmpty
      ? { text: t("aiGuide.noExpertsYet"), takumiIds: [] as string[] }
      : {
          text: t("aiGuide.seeYourPhoto"),
          takumiIds: takumis.filter((tk) => tk.isLive).slice(0, 2).map((tk) => tk.id),
        }

    setTimeout(() => {
      const aiMsg: AiMessage = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: response.text,
        suggestions: response.takumiIds.map((id) => {
          const tk = takumis.find((t) => t.id === id)
          return tk ? { takumiId: id, name: tk.name, match: 92, reason: tk.subcategory } : null
        }).filter(Boolean) as AiMessage["suggestions"],
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 1200)
  }

  const quickSuggestions = [
    t("aiGuide.quickSuggestion1"),
    t("aiGuide.quickSuggestion2"),
    t("aiGuide.quickSuggestion3"),
    t("aiGuide.quickSuggestion4"),
  ]

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Sparkles className="size-4 text-accent" />
                </div>
              )}
              <div className="flex max-w-[80%] flex-col gap-2">
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {msg.image && (
                    <div className="mb-2 flex size-20 items-center justify-center rounded-lg bg-muted/50">
                      <ImageIcon className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  {msg.content}
                </div>

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {msg.suggestions.map((s) => {
                      const tk = takumis.find((t) => t.id === s.takumiId)
                      if (!tk) return null
                      return <TakumiCard key={s.takumiId} takumi={tk} />
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary">
                <Sparkles className="size-4 text-accent" />
              </div>
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <div className="flex gap-1">
                  <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {isEmpty && messages.length <= 1 && (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-6 text-center">
              <p className="font-jp text-2xl text-muted-foreground/30">匠</p>
              <p className="text-sm text-muted-foreground">
                {t("aiGuide.noExpertsRegistered")}
              </p>
              <Button asChild variant="outline" size="sm" className="rounded-lg text-xs">
                <Link href="/categories">{t("aiGuide.viewCategories")}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Suggestions */}
      <div className="border-t border-border bg-card px-4 py-2">
        <div className="mx-auto max-w-lg flex gap-2 overflow-x-auto scrollbar-none">
          {quickSuggestions.map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <button
            onClick={handlePhotoUpload}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Camera className="size-5" />
          </button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={t("aiGuide.inputPlaceholder")}
            className="h-10 rounded-full"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim()}
            size="icon"
            className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

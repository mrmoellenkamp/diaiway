"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageContainer } from "@/components/page-container"
import { TakumiCard } from "@/components/takumi-card"
import { useTakumis } from "@/hooks/use-takumis"
import { Camera, Image as ImageIcon, Send, Sparkles } from "lucide-react"
import type { AiMessage } from "@/lib/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function AiGuidePage() {
  const { takumis, isEmpty } = useTakumis()
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Konichiwa! Ich bin dein diAiway-Guide. Beschreibe dein Problem oder lade ein Foto hoch -- ich finde den passenden Experten fuer dich!",
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  /** Dynamically match takumis by keyword against category/subcategory/bio */
  function findMatchingTakumis(text: string) {
    if (isEmpty || takumis.length === 0) return []
    const lower = text.toLowerCase()
    const keywords = lower.split(/\s+/).filter((w) => w.length > 2)

    const scored = takumis.map((t) => {
      const haystack = `${t.categoryName} ${t.subcategory} ${t.bio} ${t.name}`.toLowerCase()
      let score = 0
      for (const kw of keywords) {
        if (haystack.includes(kw)) score += 1
      }
      if (t.isLive) score += 0.5
      return { takumi: t, score }
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
        text: `Ich habe ${matches.length} passende Experten fuer dich gefunden:`,
        takumiIds: matches.map((m) => m.id),
      }
    }
    if (isEmpty) {
      return {
        text: "Aktuell sind noch keine Experten registriert. Schau bald wieder vorbei!",
        takumiIds: [],
      }
    }
    // Fallback: show top-rated takumis
    const topRated = [...takumis].sort((a, b) => b.rating - a.rating).slice(0, 3)
    return {
      text: "Ich konnte kein genaues Match finden, aber hier sind unsere besten Experten:",
      takumiIds: topRated.map((t) => t.id),
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
          const t = takumis.find((tk) => tk.id === id)
          return t
            ? { takumiId: id, name: t.name, match: Math.round(70 + Math.random() * 25), reason: t.subcategory }
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
      content: "Ich habe ein Foto hochgeladen",
      image: "photo",
    }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    const response = isEmpty
      ? { text: "Aktuell sind noch keine Experten registriert. Schau bald wieder vorbei!", takumiIds: [] as string[] }
      : {
          text: "Ich sehe dein Foto! Hier sind die besten Experten dafuer:",
          takumiIds: takumis.filter((t) => t.isLive).slice(0, 2).map((t) => t.id),
        }

    setTimeout(() => {
      const aiMsg: AiMessage = {
        id: `a${Date.now()}`,
        role: "assistant",
        content: response.text,
        suggestions: response.takumiIds.map((id) => {
          const t = takumis.find((tk) => tk.id === id)
          return t ? { takumiId: id, name: t.name, match: 92, reason: t.subcategory } : null
        }).filter(Boolean) as AiMessage["suggestions"],
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 1200)
  }

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
                      const t = takumis.find((tk) => tk.id === s.takumiId)
                      if (!t) return null
                      return <TakumiCard key={s.takumiId} takumi={t} />
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

          {/* Empty state when no takumis exist */}
          {isEmpty && messages.length <= 1 && (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-6 text-center">
              <p className="font-jp text-2xl text-muted-foreground/30">匠</p>
              <p className="text-sm text-muted-foreground">
                Noch keine Experten registriert. Der AI-Guide kann Empfehlungen geben, sobald Experten verfuegbar sind.
              </p>
              <Button asChild variant="outline" size="sm" className="rounded-lg text-xs">
                <Link href="/categories">Kategorien ansehen</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Suggestions */}
      <div className="border-t border-border bg-card px-4 py-2">
        <div className="mx-auto max-w-lg flex gap-2 overflow-x-auto scrollbar-none">
          {["Mein Handy ist kaputt", "Pflanze stirbt", "Auto macht Gerausche", "Steuerfrage"].map((q) => (
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
            placeholder="Beschreibe dein Problem..."
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

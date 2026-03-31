"use client"

import { useState } from "react"
import { ChevronDown, User, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"

const SHUGYO_FAQ = [
  {
    q: "Wie finde ich den richtigen Takumi für mein Projekt?",
    a: "Beschreibe dein Anliegen im AI-Guide (diAIway) oder durchstöbere die Kategorien. Der AI-Guide analysiert dein Problem und schlägt passende Experten vor. Achte auf Bewertungen, Spezialisierung und die verifizierten Profile.",
  },
  {
    q: "Wie funktioniert die kostenlose Probezeit (Handshake)?",
    a: "Die ersten 5 Minuten jeder Session sind kostenlos. In dieser Zeit kannst du prüfen, ob die Chemie und Expertise stimmen. Erst danach wird die Session berechnet – und nur, wenn du sie fortsetzt.",
  },
  {
    q: "Ist meine Zahlung sicher?",
    a: "Ja. Dein Geld liegt bis zur Freigabe im Escrow. Du gibst es erst frei, wenn du mit der Session zufrieden bist. So schützen wir dich und wertschätzen gleichzeitig das Wissen deines Takumi.",
  },
] as const

const TAKUMI_FAQ = [
  {
    q: "Wie schütze ich mein Wissen als Takumi?",
    a: "Deine Profile, Beschreibungen und Session-Inhalte bleiben dein geistiges Eigentum. diAiway nutzt sie ausschließlich zur Plattformbereitstellung. Eine Weitergabe an Dritte erfolgt nur mit deiner ausdrücklichen Zustimmung.",
  },
  {
    q: "Wie werde ich Takumi und wie funktioniert die Auszahlung?",
    a: "Registriere dich, vervollständige dein Profil und aktiviere den Takumi-Modus. Nach Abschluss einer Session wird der Betrag deinem Wallet gutgeschrieben. Die Auszahlung erfolgt auf dein Bankkonto nach Prüfung und Mindestbetrag.",
  },
  {
    q: "Kann ich meine Verfügbarkeit flexibel steuern?",
    a: "Ja. Lege deinen Wochenplan fest, nutze Ausnahmen für Urlaub oder besondere Tage, und aktiviere optional den Instant-Call-Modus. So bestimmst du selbst, wann du erreichbar bist.",
  },
] as const

export function HelpFaqSection() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {/* Shugyo */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <User className="size-3.5" />
          Für Shugyo (Lernende)
        </h3>
        <div className="flex flex-col gap-2">
          {SHUGYO_FAQ.map((item, i) => {
            const id = `shugyo-${i}`
            const isOpen = openId === id
            return (
              <div
                key={id}
                className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card overflow-hidden"
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-[rgba(245,245,244,0.3)] transition-colors"
                >
                  {item.q}
                  <ChevronDown
                    className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-[rgba(231,229,227,0.4)] px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Takumi */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Briefcase className="size-3.5" />
          Für Takumi (Experten)
        </h3>
        <div className="flex flex-col gap-2">
          {TAKUMI_FAQ.map((item, i) => {
            const id = `takumi-${i}`
            const isOpen = openId === id
            return (
              <div
                key={id}
                className="rounded-xl border border-[rgba(231,229,227,0.6)] bg-card overflow-hidden"
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-[rgba(245,245,244,0.3)] transition-colors"
                >
                  {item.q}
                  <ChevronDown
                    className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-[rgba(231,229,227,0.4)] px-4 py-3 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

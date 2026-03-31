"use client"

import {
  Mail,
  MessageCircle,
  BookOpen,
  Video,
  CreditCard,
  ShieldCheck,
  HelpCircle,
  Ticket,
} from "lucide-react"
import { HelpFaqSection } from "@/components/help-faq-section"
import { SupportTicketForm } from "@/components/support-ticket-form"
import { AppSubpageHeader } from "@/components/app-subpage-header"
import { useI18n } from "@/lib/i18n"

function TopicCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[rgba(231,229,227,0.6)] bg-card p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(6,78,59,0.1)]">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </div>
    </div>
  )
}

export default function HelpPage() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-safe min-w-0">
        <AppSubpageHeader
          className="mb-6"
          title={t("footer.helpSupport")}
          subtitle={t("help.pageSubtitle")}
        />

        <div className="flex flex-col gap-8">
          {/* Contact CTA */}
          <div className="flex flex-col gap-3 rounded-xl border border-[rgba(6,78,59,0.2)] bg-[rgba(6,78,59,0.05)] p-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-5 text-primary" />
              <span className="font-semibold text-foreground">Direkter Support</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Unser Support-Team hilft dir gerne weiter. Schreib uns eine E-Mail oder nutze das Support-Ticket unten.
            </p>
            <a
              href="mailto:support@diaiway.com"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[rgba(6,78,59,0.9)] w-fit"
            >
              <Mail className="size-4" />
              support@diaiway.com
            </a>
          </div>

          {/* Help topics */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">Häufige Themen</h2>
            <div className="flex flex-col gap-2">
              <TopicCard
                icon={BookOpen}
                title="Buchung & Termine"
                desc="Wie buche ich eine Session? Wie ändere oder storniere ich einen Termin?"
              />
              <TopicCard
                icon={Video}
                title="Video-Sessions"
                desc="Probleme mit dem Video-Call? Technische Anforderungen und Tipps."
              />
              <TopicCard
                icon={CreditCard}
                title="Zahlung & Abrechnung"
                desc="Zahlungsmethoden, Rechnungen und Rückerstattungen."
              />
              <TopicCard
                icon={ShieldCheck}
                title="Konto & Sicherheit"
                desc="Passwort ändern, Konto löschen, Datenschutz."
              />
              <TopicCard
                icon={MessageCircle}
                title="Für Takumi"
                desc="Profil einrichten, Verfügbarkeit verwalten, Einnahmen abrufen."
              />
            </div>
          </div>

          {/* FAQ: 3 Shugyo + 3 Takumi */}
          <section id="faq" className="scroll-mt-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Häufige Fragen (FAQ)
            </h2>
            <HelpFaqSection />
          </section>

          {/* Support Ticket (Platzhalter) */}
          <section id="ticket" className="scroll-mt-4">
            <div className="mb-3 flex items-center gap-2">
              <Ticket className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Support-Ticket</h2>
            </div>
            <SupportTicketForm />
          </section>
        </div>
      </main>
    </div>
  )
}

import Link from "next/link"
import { ArrowLeft, Construction, Mail, MessageCircle, BookOpen, Video, CreditCard, ShieldCheck, HelpCircle } from "lucide-react"

export const metadata = { title: "Hilfe & Support – diAiway" }

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
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
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
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-40">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4 text-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Hilfe & Support</h1>
            <p className="text-xs text-muted-foreground">Wie können wir dir helfen?</p>
          </div>
        </div>

        {/* Placeholder notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Construction className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Platzhalter – </span>
            Diese Seite wird noch ausgebaut. Bei dringenden Fragen wende dich direkt per E-Mail an uns.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          {/* Contact CTA */}
          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-5 text-primary" />
              <span className="font-semibold text-foreground">Direkter Support</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Unser Support-Team hilft dir gerne weiter. Schreib uns einfach eine E-Mail und wir melden uns schnellstmöglich.
            </p>
            <a
              href="mailto:support@diaiway.com"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 w-fit"
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

          {/* FAQ placeholder */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Häufige Fragen (FAQ)</h2>
            <div className="flex flex-col gap-2">
              {[
                "Wie funktioniert die kostenlose Probezeit?",
                "Wann wird meine Zahlung belastet?",
                "Kann ich eine Session verlängern?",
                "Wie werde ich Takumi?",
                "Wie melde ich einen Nutzer?",
              ].map((q) => (
                <div
                  key={q}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground"
                >
                  <span>{q}</span>
                  <span className="text-xs text-primary">[Antwort folgt]</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
            Weitere Hilfeseiten und ein vollständiges FAQ werden demnächst hinzugefügt.
          </div>

        </div>
      </main>
    </div>
  )
}

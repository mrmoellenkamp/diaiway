import Link from "next/link"
import { ArrowLeft, Compass, Handshake, Sparkles, Ship } from "lucide-react"

export const metadata = {
  title: "Wie es funktioniert – diAiway",
  description: "Der Weg von Shugyo zu Takumi. Entdecke, wie wertvoller Wissensaustausch auf diAiway funktioniert.",
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-safe min-w-0">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4 text-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Wie es funktioniert
            </h1>
            <p className="text-xs text-muted-foreground">
              Der Path: Von Shugyo zu Takumi
            </p>
          </div>
        </div>

        {/* Hero / Emotional Intro */}
        <section className="mb-10 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="size-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Dein Weg beginnt hier</span>
          </div>
          <h2 className="text-xl font-bold text-foreground leading-tight mb-3">
            Jeder Meister war einmal Lernender.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Auf diAiway nennen wir die Lernenden <strong className="text-foreground">Shugyo</strong> – Menschen auf dem Weg.
            Und die Meister <strong className="text-foreground">Takumi</strong> – Experten, die ihr Wissen teilen.
            Wie auf einer Reise, bei der jeder Hafen neue Erkenntnisse bringt: Du stellst deine Frage, findest deinen Takumi,
            und lernst in einer Live-Session von jemandem, der den Weg bereits gegangen ist.
          </p>
        </section>

        {/* Steps */}
        <div className="flex flex-col gap-6">
          <StepCard
            step={1}
            icon={Sparkles}
            title="Problem beschreiben oder Frage stellen"
            desc="Beschreibe dein Anliegen – per Text, Foto oder Voice. Unser AI-Guide (diAIway) analysiert dein Projekt und schlägt dir passende Takumis vor. Oder stöbere in den Kategorien und finde deinen Experten."
          />
          <StepCard
            step={2}
            icon={Handshake}
            title="Die ersten 5 Minuten sind gratis"
            desc="Starte deine Video- oder Sprachanruf-Session. Die ersten fünf Minuten heißen wir Handshake - sie gehören dir. Nutze sie, um zu prüfen, ob die Chemie stimmt und die Expertise passt."
          />
          <StepCard
            step={3}
            icon={Ship}
            title="Sicher bezahlen, Wissen wertschätzen"
            desc="Erst wenn du zufrieden bist, gibst du die Zahlung frei. Dein Geld liegt bis dahin sicher im Escrow. So schützen wir dich – und wertschätzen das Wissen deines Takumi."
          />
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col gap-4">
          <Link
            href="/register"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Jetzt kostenlos starten
          </Link>
          <Link
            href="/"
            className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Zurück zur Startseite
          </Link>
        </div>
      </main>
    </div>
  )
}

function StepCard({
  step,
  icon: Icon,
  title,
  desc,
}: {
  step: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-primary/80">Schritt {step}</span>
          <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  )
}

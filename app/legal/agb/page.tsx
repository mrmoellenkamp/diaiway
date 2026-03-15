import Link from "next/link"
import { ArrowLeft, Scale, ShieldCheck, FileText } from "lucide-react"

export const metadata = { title: "AGB – diAIway" }

function Section({ num, title, children, critical }: {
  num: number
  title: string
  children: React.ReactNode
  critical?: boolean
}) {
  return (
    <section className="flex flex-col gap-2 border-b border-border/40 pb-6 last:border-0">
      <h2 className={`font-semibold ${critical ? "text-primary" : "text-foreground"}`}>
        § {num} {title}
      </h2>
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main className="mx-auto w-full max-w-lg px-4 py-8 pb-safe min-w-0">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/profile"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
            aria-label="Zurück"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AGB</h1>
            <p className="text-sm text-muted-foreground">Allgemeine Geschäftsbedingungen</p>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          
          <div className="rounded-2xl bg-muted/30 p-4 border border-border/60 flex gap-3 items-start">
            <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-muted-foreground uppercase tracking-tight font-medium">
              Geltungsbereich für die Nutzung der Plattform diAIway durch Takumis und Shugyos.
            </p>
          </div>

          <Section num={1} title="Geltungsbereich">
            <p>
              Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge, die über die Plattform diAIway zwischen der <strong>JM faircharge UG (haftungsbeschränkt)</strong>, Esmarchstraße 13, 10407 Berlin (nachfolgend „Anbieter“) und den Nutzern der Plattform geschlossen werden.
            </p>
          </Section>

          <Section num={2} title="Leistungsbeschreibung">
            <p>
              diAIway ist eine Vermittlungsplattform, auf der Experten (Takumi) Wissen und Beratungsleistungen an Lernende (Shugyo) vermitteln. Der Anbieter stellt lediglich die technische Infrastruktur und die Zahlungsabwicklung zur Verfügung.
            </p>
          </Section>

          <Section num={3} title="Vertragsschluss">
            <p>
              Der Vertrag über die Nutzung der Plattform kommt mit der Registrierung des Nutzers zustande. Verträge über Beratungsleistungen kommen direkt zwischen dem Takumi und dem Shugyo zustande.
            </p>
          </Section>

          <Section num={4} title="Gebühren und Zahlungen">
            <p>
              Die Nutzung der Plattform ist für Shugyos grundsätzlich kostenfrei. Takumis zahlen für die erfolgreiche Vermittlung eine Systemgebühr. Die Abrechnung erfolgt automatisiert über den Zahlungsdienstleister Stripe.
            </p>
          </Section>

          <Section num={5} title="Widerrufsrecht">
            <p>
              Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Informationen hierzu finden sich in der separaten Widerrufsbelehrung. Bei digitalen Dienstleistungen (Calls) erlischt das Widerrufsrecht vorzeitig, wenn die Dienstleistung mit ausdrücklicher Zustimmung des Nutzers vor Ende der Widerrufsfrist vollständig erbracht wurde.
            </p>
          </Section>

          <Section num={6} title="Haftung">
            <p>
              Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit. Für einfache Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten).
            </p>
          </Section>

          <Section num={7} title="Schlussbestimmungen">
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand für Streitigkeiten mit Kaufleuten ist <strong>Berlin</strong>.
            </p>
          </Section>

          <div className="mt-8 pt-8 border-t border-border/40 text-center flex flex-col items-center gap-2">
            <Scale className="size-4 text-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Stand: März 2026 · JM faircharge UG (haftungsbeschränkt)
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}
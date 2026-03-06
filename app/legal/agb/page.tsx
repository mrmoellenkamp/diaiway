import Link from "next/link"
import { ArrowLeft, Construction } from "lucide-react"

export const metadata = { title: "AGB – diAiway" }

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-foreground">
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
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-24">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4 text-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Allgemeine Geschäftsbedingungen</h1>
            <p className="text-xs text-muted-foreground">diAiway</p>
          </div>
        </div>

        {/* Placeholder notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Construction className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Platzhalter – </span>
            Diese AGB sind noch nicht rechtsverbindlich und müssen vor dem Live-Gang von einem Rechtsanwalt geprüft und angepasst werden.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          <Section num={1} title="Geltungsbereich">
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der Plattform diAiway und gelten für alle Nutzer – sowohl Shugyo (Lernende) als auch Takumi (Experten).
            </p>
            <p>
              Durch die Registrierung und Nutzung der Plattform akzeptieren Sie diese Bedingungen.
            </p>
          </Section>

          <Section num={2} title="Leistungsbeschreibung">
            <p>
              diAiway vermittelt Live-Video-Beratungen zwischen Takumi (Experten) und Shugyo (Nutzern). Die Plattform stellt die technische Infrastruktur bereit und tritt als Vermittler auf.
            </p>
            <p>
              Die ersten 5 Minuten jeder Session sind kostenlos. Danach wird der vereinbarte Preis des Takumi fällig.
            </p>
          </Section>

          <Section num={3} title="Registrierung und Nutzerkonto">
            <p>
              Die Nutzung der Plattform setzt eine Registrierung voraus. Die Angabe wahrheitsgemäßer Daten ist verpflichtend. Jede natürliche oder juristische Person darf nur ein Konto führen.
            </p>
            <p>
              Nutzer sind für die Sicherheit ihrer Zugangsdaten selbst verantwortlich.
            </p>
          </Section>

          <Section num={4} title="Zahlungsbedingungen">
            <p>
              Zahlungen werden über unser Escrow-System via Stripe abgewickelt. Der Betrag wird vor der Session autorisiert und nach der Freigabe durch den Shugyo an den Takumi ausgezahlt.
            </p>
            <p>
              diAiway erhebt eine Vermittlungsprovision von [X]% auf jede abgeschlossene Session.
            </p>
          </Section>

          <Section num={5} title="Stornierung und Rückerstattung">
            <p>
              Die Stornierungsbedingungen werden individuell vom Takumi festgelegt und sind auf der jeweiligen Buchungsseite klar ausgewiesen.
            </p>
            <p>
              Storniert der Takumi eine bestätigte Buchung, erhält der Shugyo stets eine vollständige Rückerstattung.
            </p>
          </Section>

          <Section num={6} title="Pflichten der Nutzer">
            <p>
              Nutzer verpflichten sich, die Plattform nicht für illegale Aktivitäten zu nutzen, andere Nutzer nicht zu belästigen und keine Inhalte hochzuladen, die gegen geltendes Recht verstoßen.
            </p>
          </Section>

          <Section num={7} title="Haftungsausschluss">
            <p>
              diAiway haftet nicht für die Qualität der von Takumis erbrachten Beratungsleistungen. Die Plattform fungiert ausschließlich als technischer Vermittler.
            </p>
            <p>
              Für Schäden durch höhere Gewalt oder technische Störungen übernimmt diAiway keine Haftung.
            </p>
          </Section>

          <Section num={8} title="Geistiges Eigentum">
            <p>
              Alle Inhalte der Plattform (Design, Texte, Software) sind urheberrechtlich geschützt. Eine Nutzung ohne ausdrückliche Genehmigung ist nicht gestattet.
            </p>
          </Section>

          <Section num={9} title="Kündigung">
            <p>
              Nutzer können ihr Konto jederzeit ohne Angabe von Gründen löschen. diAiway behält sich das Recht vor, Konten bei schwerwiegenden Verstößen gegen diese AGB zu sperren oder zu löschen.
            </p>
          </Section>

          <Section num={10} title="Anwendbares Recht">
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist [Ort des Unternehmenssitzes].
            </p>
          </Section>

          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
            Stand: [Datum einsetzen] · Diese AGB sind ein Platzhalter und ersetzen keine Rechtsberatung. Lassen Sie diese vor dem Live-Gang anwaltlich prüfen.
          </div>

        </div>
      </main>
    </div>
  )
}

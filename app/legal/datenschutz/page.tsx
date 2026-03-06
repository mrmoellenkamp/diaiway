import Link from "next/link"
import { ArrowLeft, Construction } from "lucide-react"

export const metadata = { title: "Datenschutz – diAiway" }

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-foreground">
        {num}. {title}
      </h2>
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export default function DatenschutzPage() {
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
            <h1 className="text-lg font-semibold text-foreground">Datenschutzerklärung</h1>
            <p className="text-xs text-muted-foreground">gemäß DSGVO · diAiway</p>
          </div>
        </div>

        {/* Placeholder notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Construction className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Platzhalter – </span>
            Diese Datenschutzerklärung ist noch nicht vollständig und muss vor dem Live-Gang rechtssicher ausgearbeitet werden.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          <Section num={1} title="Verantwortlicher">
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:
            </p>
            <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs">
              diAiway<br />
              [Straße und Hausnummer]<br />
              [PLZ] [Ort]<br />
              E-Mail: datenschutz@diaiway.com
            </div>
          </Section>

          <Section num={2} title="Erhobene Daten">
            <p>Wir verarbeiten folgende personenbezogene Daten:</p>
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li>Name und E-Mail-Adresse (bei Registrierung)</li>
              <li>Profilbild (optional, hochgeladen durch den Nutzer)</li>
              <li>Buchungsdaten (Datum, Uhrzeit, Experte, Preis)</li>
              <li>Zahlungsdaten (verarbeitet durch Stripe, nicht direkt gespeichert)</li>
              <li>Nutzungsverhalten und Session-Verlauf</li>
              <li>IP-Adresse und technische Gerätedaten</li>
            </ul>
          </Section>

          <Section num={3} title="Zweck der Verarbeitung">
            <p>Ihre Daten werden verarbeitet für:</p>
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li>Betrieb und Bereitstellung der Plattform</li>
              <li>Durchführung und Abrechnung von Buchungen</li>
              <li>Kommunikation zwischen Nutzern und Support</li>
              <li>Verbesserung unserer Dienste und Sicherheit</li>
            </ul>
          </Section>

          <Section num={4} title="Rechtsgrundlage">
            <p>
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen).
            </p>
          </Section>

          <Section num={5} title="Drittanbieter & Auftragsverarbeiter">
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li><span className="font-medium text-foreground">Vercel</span> – Hosting und Infrastruktur (USA, SCCs)</li>
              <li><span className="font-medium text-foreground">Prisma / Neon</span> – Datenbankhosting</li>
              <li><span className="font-medium text-foreground">Stripe</span> – Zahlungsabwicklung</li>
              <li><span className="font-medium text-foreground">Daily.co</span> – Video-Sessions</li>
              <li><span className="font-medium text-foreground">Vercel Blob</span> – Bildspeicherung</li>
            </ul>
          </Section>

          <Section num={6} title="Speicherdauer">
            <p>
              Personenbezogene Daten werden gelöscht, sobald sie für den Verarbeitungszweck nicht mehr erforderlich sind. Buchungs- und Zahlungsdaten werden entsprechend der gesetzlichen Aufbewahrungsfristen (i.d.R. 10 Jahre) gespeichert.
            </p>
          </Section>

          <Section num={7} title="Ihre Rechte">
            <p>Sie haben gemäß DSGVO folgende Rechte:</p>
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li><span className="font-medium text-foreground">Auskunft</span> – Art. 15 DSGVO</li>
              <li><span className="font-medium text-foreground">Berichtigung</span> – Art. 16 DSGVO</li>
              <li><span className="font-medium text-foreground">Löschung</span> – Art. 17 DSGVO</li>
              <li><span className="font-medium text-foreground">Einschränkung</span> – Art. 18 DSGVO</li>
              <li><span className="font-medium text-foreground">Datenübertragbarkeit</span> – Art. 20 DSGVO</li>
              <li><span className="font-medium text-foreground">Widerspruch</span> – Art. 21 DSGVO</li>
            </ul>
            <p>
              Zur Ausübung Ihrer Rechte wenden Sie sich an: datenschutz@diaiway.com
            </p>
          </Section>

          <Section num={8} title="Beschwerderecht">
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig ist die Aufsichtsbehörde Ihres Bundeslandes.
            </p>
          </Section>

          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
            Stand: [Datum einsetzen] · Diese Datenschutzerklärung ist ein Platzhalter. Vor dem Live-Gang muss sie durch eine vollständige, rechtskonforme Erklärung ersetzt werden.
          </div>

        </div>
      </main>
    </div>
  )
}

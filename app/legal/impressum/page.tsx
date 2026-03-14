import Link from "next/link"
import { ArrowLeft, Construction, Mail, MapPin, Phone, Building2, AlertTriangle } from "lucide-react"

export const metadata = { title: "Impressum – diAiway" }

/** Visually marks a field the operator must fill in before going live */
function Todo({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <AlertTriangle className="size-3 shrink-0" />
      {children}
    </span>
  )
}

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-safe min-w-0">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Impressum</h1>
        </div>

        {/* Placeholder notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Construction className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Platzhalter aktiv – </span>
            Alle orange markierten Felder müssen vor dem Live-Gang durch echte Angaben ersetzt werden.
            Pflichtangaben gem. § 5 TMG, § 18 Abs. 2 MStV, § 2 DL-InfoV.
          </p>
        </div>

        <div className="flex flex-col gap-6 text-sm text-foreground leading-relaxed">

          {/* § 5 TMG */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Angaben gemäß § 5 TMG</h2>
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">diAiway</span>
                  <Todo>Rechtsform eintragen, z.B. „GmbH", „UG (haftungsbeschränkt)" oder „Einzelunternehmen"</Todo>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1 text-muted-foreground">
                  <Todo>Straße und Hausnummer</Todo>
                  <Todo>PLZ und Ort</Todo>
                  <span>Deutschland</span>
                </div>
              </div>
            </div>
          </section>

          {/* Vertreten durch */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Vertreten durch</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <Todo>Vollständiger Name des/der Geschäftsführer(s) / Inhaber(s)</Todo>
            </div>
          </section>

          {/* Kontakt */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Kontakt</h2>
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Phone className="size-4 shrink-0" />
                <Todo>Telefonnummer (mind. erreichbar in DE, § 5 TMG)</Todo>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="size-4 shrink-0" />
                <span>kontakt@diaiway.com</span>
              </div>
            </div>
          </section>

          {/* Handelsregister */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Handelsregister</h2>
            <p className="text-xs text-muted-foreground">(nur wenn im Handelsregister eingetragen)</p>
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <span>Registergericht: <Todo>z.B. Amtsgericht Berlin-Charlottenburg</Todo></span>
              <span>Registernummer: <Todo>z.B. HRB 123456 B</Todo></span>
            </div>
          </section>

          {/* USt-ID */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Umsatzsteuer-ID</h2>
            <p className="text-xs text-muted-foreground">(gem. § 27a UStG, nur wenn vorhanden)</p>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <Todo>USt-IdNr., z.B. DE123456789</Todo>
            </div>
          </section>

          {/* Inhaltlich Verantwortlicher */}
          <section className="flex flex-col gap-3">
            {/* § 18 Abs. 2 MStV ersetzt den alten § 55 Abs. 2 RStV seit November 2020 */}
            <h2 className="text-base font-bold">Inhaltlich verantwortlich (§ 18 Abs. 2 MStV)</h2>
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <Todo>Vor- und Nachname der verantwortlichen Person</Todo>
              <span className="text-xs">(Anschrift wie oben)</span>
            </div>
          </section>

          {/* § 36 VSBG — PFLICHT für Verbraucherverträge */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Streitbeilegung (§ 36 VSBG)</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground leading-relaxed">
              <p className="mb-2">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
                <a
                  href="https://ec.europa.eu/consumers/odr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  https://ec.europa.eu/consumers/odr/
                </a>
              </p>
              <p>
                Unsere E-Mail-Adresse lautet: kontakt@diaiway.com
              </p>
              <p className="mt-2">
                {/* Wähle eine der beiden Formulierungen und lösche die andere */}
                <Todo>
                  Variante A (Nicht-Teilnahme): „Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."
                </Todo>
                <span className="mx-2 text-xs">— oder —</span>
                <Todo>
                  Variante B (Teilnahme): „Wir nehmen an Streitbeilegungsverfahren vor folgender Verbraucherschlichtungsstelle teil: [Name und Adresse der Schlichtungsstelle]."
                </Todo>
              </p>
            </div>
            <p className="text-xs text-destructive font-medium">
              ⚠ Diese Angabe ist für Plattformen mit Verbraucherverträgen gesetzlich verpflichtend (§ 36 VSBG).
            </p>
          </section>

          {/* Berufshaftpflicht (optional) */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Berufshaftpflichtversicherung</h2>
            <p className="text-xs text-muted-foreground">(nur wenn vorhanden / gesetzlich gefordert)</p>
            <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <span>Name der Versicherung: <Todo>z.B. Allianz AG</Todo></span>
              <span>Geltungsraum: <Todo>z.B. Deutschland / EU</Todo></span>
            </div>
          </section>

          <div className="mt-2 rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
            Stand: <Todo>Datum einsetzen, z.B. März 2025</Todo> · Alle orange markierten Felder sind Platzhalter und müssen vor Inbetriebnahme ersetzt werden.
          </div>
        </div>
      </main>
    </div>
  )
}

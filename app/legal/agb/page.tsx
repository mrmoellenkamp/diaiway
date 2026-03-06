import Link from "next/link"
import { ArrowLeft, Construction, AlertTriangle } from "lucide-react"

export const metadata = { title: "AGB – diAiway" }

function Section({ num, title, children, critical }: {
  num: number
  title: string
  children: React.ReactNode
  critical?: boolean
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={`font-semibold ${critical ? "text-destructive" : "text-foreground"}`}>
        § {num} {title}
        {critical && <span className="ml-2 text-xs font-normal">(gesetzlich zwingend)</span>}
      </h2>
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

/** Visually marks a field the operator must fill in before going live */
function Todo({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <AlertTriangle className="size-3 shrink-0" />
      {children}
    </span>
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
            <p className="text-xs text-muted-foreground">diAiway · Stand: <Todo>Datum</Todo></p>
          </div>
        </div>

        {/* Placeholder notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Construction className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Platzhalter aktiv – </span>
            Diese AGB sind rechtlich noch nicht bindend. Alle orange markierten Felder müssen ausgefüllt und der gesamte Text vor dem Live-Gang anwaltlich geprüft werden.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          <Section num={1} title="Geltungsbereich">
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Vertragsbeziehungen zwischen der{" "}
              <Todo>diAiway [Rechtsform], [Adresse]</Todo>{" "}(nachfolgend „diAiway") und den Nutzern der Plattform
              – sowohl Shugyo (Lernende) als auch Takumi (Experten).
            </p>
            <p>
              Durch die Registrierung stimmen Nutzer diesen AGB ausdrücklich zu. Abweichende Bedingungen des Nutzers
              werden nicht anerkannt.
            </p>
            <p>
              Verbraucher im Sinne dieser AGB ist jede natürliche Person, die die Plattform zu einem Zweck nutzt,
              der überwiegend weder ihrer gewerblichen noch ihrer selbstständigen beruflichen Tätigkeit zugerechnet
              werden kann (§ 13 BGB).
            </p>
          </Section>

          <Section num={2} title="Mindestnutzeralter und Geschäftsfähigkeit">
            <p>
              Die Nutzung der Plattform ist nur für Personen ab{" "}
              <Todo>18 Jahre (oder 16 mit Elternzustimmung – wählen und eintragen)</Todo>{" "}
              gestattet. Minderjährige Nutzer bedürfen der ausdrücklichen Zustimmung ihrer Erziehungsberechtigten.
            </p>
            <p>
              Mit der Registrierung versichert der Nutzer, das erforderliche Mindestalter erreicht zu haben.
            </p>
          </Section>

          <Section num={3} title="Vertragsschluss">
            <p>
              Ein Buchungsvertrag zwischen Shugyo und Takumi kommt zustande, wenn der Takumi die Buchungsanfrage
              bestätigt. diAiway ist nicht Vertragspartei, sondern vermittelt lediglich die Vertragsbeziehung.
            </p>
            <p>
              Der Vertrag zwischen Shugyo und diAiway (Nutzungsvertrag) kommt mit der Bestätigung der Registrierung
              per E-Mail zustande.
            </p>
          </Section>

          <Section num={4} title="Leistungsbeschreibung">
            <p>
              diAiway stellt eine Vermittlungsplattform für Live-Video-Beratungen zur Verfügung. Die Plattform
              verbindet Shugyo (Ratsuchende) mit Takumi (Experten) über Echtzeit-Videotelefonie.
            </p>
            <p>
              Die ersten 5 Minuten jeder Session sind kostenfrei (Probezeit). Nach Ablauf der Probezeit wird der vom
              Takumi festgelegte Preis fällig, sofern der Shugyo die Session fortsetzt.
            </p>
            <p>
              Ein Anspruch auf Verfügbarkeit bestimmter Takumi oder auf ununterbrochene Plattformverfügbarkeit
              besteht nicht.
            </p>
          </Section>

          <Section num={5} title="Registrierung und Nutzerkonto">
            <p>
              Die Nutzung der Plattform setzt eine Registrierung mit wahrheitsgemäßen Angaben voraus. Jede
              natürliche oder juristische Person darf nur ein Konto führen.
            </p>
            <p>
              Nutzer sind verpflichtet, ihre Zugangsdaten geheim zu halten und diAiway unverzüglich zu
              informieren, wenn Anhaltspunkte für einen Missbrauch des Kontos vorliegen.
            </p>
          </Section>

          <Section num={6} title="Preise und Zahlungsbedingungen">
            <p>
              Alle angezeigten Preise verstehen sich in Euro (€) inkl. der gesetzlichen Mehrwertsteuer
              (<Todo>Steuersatz prüfen: 19 % oder umsatzsteuerfrei gem. § 4 UStG?</Todo>).
            </p>
            <p>
              Zahlungen werden über <strong>Stripe</strong> (Stripe Payments Europe, Ltd.) als
              Zahlungsdienstleister abgewickelt. diAiway erhält den Zahlbetrag treuhänderisch (Escrow) und
              leitet ihn nach erfolgreicher Session an den Takumi weiter.
            </p>
            <p>
              diAiway erhebt eine Vermittlungsprovision von{" "}
              <Todo>[X] % (z.B. 15 %)</Todo> auf den Sessionpreis. Diese wird automatisch einbehalten.
            </p>
          </Section>

          <Section num={7} title="Stornierung und Rückerstattung">
            <p>
              Die Stornierungsbedingungen werden individuell vom jeweiligen Takumi festgelegt und sind auf
              der Buchungsseite vor Abschluss der Buchung transparent ausgewiesen.
            </p>
            <p>
              Storniert der Takumi eine bestätigte Buchung aus eigenem Verschulden, erhält der Shugyo
              stets eine vollständige Rückerstattung des bezahlten Betrags.
            </p>
            <p>
              Rückerstattungen werden über Stripe bearbeitet. Die Gutschrift auf dem Zahlungsmittel des
              Shugyo erfolgt in der Regel innerhalb von{" "}
              <Todo>5–10 Werktagen (Stripe-Standard prüfen)</Todo>.
            </p>
          </Section>

          {/* WIDERRUFSRECHT — kritisch, Abmahnrisiko! */}
          <Section num={8} title="Widerrufsrecht" critical>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              ⚠ <strong>Pflichtangabe nach § 312g BGB i.V.m. Art. 246a EGBGB</strong> (EU-Verbraucherrechterichtlinie).
              Fehlt diese Belehrung, verlängert sich die Widerrufsfrist auf 12 Monate + 14 Tage.
            </div>
            <p className="font-medium text-foreground">Widerrufsrecht für Verbraucher</p>
            <p>
              Verbraucher haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu
              widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsschlusses.
            </p>
            <p>
              Um das Widerrufsrecht auszuüben, müssen Sie uns (<Todo>Name, Adresse, E-Mail</Todo>) mittels einer
              eindeutigen Erklärung (z.B. Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu
              widerrufen, informieren.
            </p>
            <p className="font-medium text-foreground">Erlöschen des Widerrufsrechts</p>
            <p>
              Das Widerrufsrecht erlischt bei Dienstleistungen, wenn wir die Dienstleistung vollständig
              erbracht haben und mit der Ausführung erst begonnen haben, nachdem der Verbraucher dazu
              seine ausdrückliche Zustimmung gegeben hat und gleichzeitig seine Kenntnis davon bestätigt
              hat, dass er sein Widerrufsrecht verliert, sobald wir den Vertrag vollständig erfüllt haben.
            </p>
            <p>
              <Todo>
                Muster-Widerrufsformular gem. Anlage 2 zu Art. 246a § 1 Abs. 2 S. 1 Nr. 1 EGBGB
                hier verlinken oder abdrucken — Vorlage: https://www.gesetze-im-internet.de/egbgb/anlage_2.html
              </Todo>
            </p>
          </Section>

          <Section num={9} title="Pflichten der Nutzer">
            <p>Nutzer verpflichten sich:</p>
            <ul className="ml-4 list-disc flex flex-col gap-1">
              <li>die Plattform nicht für illegale Aktivitäten zu nutzen</li>
              <li>keine falschen oder irreführenden Angaben zu machen</li>
              <li>andere Nutzer nicht zu belästigen, zu bedrohen oder zu diskriminieren</li>
              <li>keine urheberrechtlich geschützten Inhalte ohne Genehmigung hochzuladen</li>
              <li>Sessions nicht ohne Zustimmung aufzuzeichnen</li>
            </ul>
            <p>
              Bei Verstößen behält sich diAiway das Recht vor, das Konto ohne Vorankündigung zu sperren.
            </p>
          </Section>

          <Section num={10} title="Haftung von diAiway">
            <p>
              diAiway haftet als Vermittler nicht für die Qualität, Richtigkeit oder Vollständigkeit der
              von Takumis erbrachten Beratungsleistungen.
            </p>
            <p>
              Die Haftung von diAiway ist auf Vorsatz und grobe Fahrlässigkeit beschränkt. Bei der
              Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) haftet diAiway auch bei
              leichter Fahrlässigkeit, jedoch begrenzt auf den vertragstypisch vorhersehbaren Schaden.
            </p>
            <p>
              Die Haftungsbeschränkung gilt nicht für Schäden aus der Verletzung des Lebens, des Körpers
              oder der Gesundheit sowie für Ansprüche nach dem Produkthaftungsgesetz.
            </p>
          </Section>

          <Section num={11} title="Haftung für externe Inhalte (§§ 7–10 TMG / DSA)">
            <p>
              diAiway ist als Hosting-Provider nach §§ 7–10 TMG (künftig: Digital Services Act) nicht
              verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen. Bei
              Bekanntwerden von Rechtsverletzungen werden entsprechende Inhalte unverzüglich entfernt.
            </p>
          </Section>

          <Section num={12} title="Geistiges Eigentum">
            <p>
              Alle Inhalte der Plattform (Design, Texte, Software, Marken) sind urheberrechtlich geschützt
              und Eigentum von diAiway oder der jeweiligen Rechteinhaber. Eine Nutzung ohne ausdrückliche
              schriftliche Genehmigung ist untersagt.
            </p>
            <p>
              Nutzer räumen diAiway eine nicht-exklusive, weltweite, kostenlose Lizenz an hochgeladenen
              Inhalten (z.B. Profilbild) ein, soweit dies für den Betrieb der Plattform erforderlich ist.
            </p>
          </Section>

          <Section num={13} title="AGB-Änderungen">
            <p>
              diAiway behält sich vor, diese AGB mit einer Ankündigungsfrist von mindestens{" "}
              <Todo>30 Tagen (Frist festlegen)</Todo> zu ändern. Über Änderungen werden Nutzer per
              E-Mail an die hinterlegte Adresse informiert.
            </p>
            <p>
              Widerspricht ein Nutzer den geänderten AGB nicht innerhalb der Frist, gelten die neuen
              AGB als akzeptiert. Auf dieses Recht wird in der Änderungsmitteilung ausdrücklich
              hingewiesen.
            </p>
          </Section>

          <Section num={14} title="Kündigung">
            <p>
              Nutzer können ihr Konto jederzeit ohne Angabe von Gründen löschen. Bestehende,
              bereits gebuchte Sessions sind vorher abzuwickeln.
            </p>
            <p>
              diAiway behält sich das Recht vor, Konten bei schwerwiegenden oder wiederholten Verstößen
              gegen diese AGB fristlos zu sperren oder zu löschen.
            </p>
          </Section>

          <Section num={15} title="Datenschutz">
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
              <Link href="/legal/datenschutz" className="text-primary underline underline-offset-2">
                Datenschutzerklärung
              </Link>
              , die Bestandteil dieser AGB ist.
            </p>
          </Section>

          <Section num={16} title="Streitbeilegung (§ 36 VSBG, Art. 14 ODR-VO)">
            <p>
              Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung bereit:{" "}
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
              <Todo>
                Wählen: „Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
                Verbraucherschlichtungsstelle teilzunehmen." — ODER — Name der Schlichtungsstelle und
                Link angeben, falls Teilnahme gewünscht.
              </Todo>
            </p>
          </Section>

          <Section num={17} title="Anwendbares Recht und Gerichtsstand">
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts (CISG).
            </p>
            <p>
              Gerichtsstand für Streitigkeiten mit Kaufleuten oder juristischen Personen des öffentlichen
              Rechts ist <Todo>Ort des Unternehmenssitzes, z.B. Berlin</Todo>.
            </p>
            <p>
              Für Verbraucher gilt als Gerichtsstand der allgemeine Gerichtsstand des Verbrauchers
              (§ 29c ZPO).
            </p>
          </Section>

          <Section num={18} title="Salvatorische Klausel">
            <p>
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die
              Wirksamkeit der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung
              tritt die gesetzliche Regelung.
            </p>
          </Section>

          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
            Stand: <Todo>Datum einsetzen</Todo> · Diese AGB sind ein erweiterter Platzhalter auf Basis deutschen
            und EU-Verbraucherrechts. Sie ersetzen keine individuelle Rechtsberatung. Vor dem Live-Gang
            anwaltlich prüfen lassen.
          </div>

        </div>
      </main>
    </div>
  )
}

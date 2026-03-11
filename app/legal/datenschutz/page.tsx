import Link from "next/link"
import { ArrowLeft, Construction, AlertTriangle } from "lucide-react"

export const metadata = { title: "Datenschutzerklärung – diAiway" }

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-foreground">{num}. {title}</h2>
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

export default function DatenschutzPage() {
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
            <h1 className="text-lg font-semibold text-foreground">Datenschutzerklärung</h1>
            <p className="text-xs text-muted-foreground">gemäß DSGVO / TDDDG · diAiway · Stand: <Todo>Datum</Todo></p>
          </div>
        </div>

        {/* Placeholder notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Construction className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Platzhalter aktiv – </span>
            Alle orange markierten Felder müssen vor dem Live-Gang ausgefüllt werden.
            Grundlage: DSGVO, § 25 TDDDG (ehem. TTDSG), TMG, DSA.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          <Section num={1} title="Verantwortlicher (Art. 4 Nr. 7 DSGVO)">
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <span className="font-semibold text-foreground">diAiway</span> <Todo>Rechtsform</Todo><br />
              <Todo>Straße und Hausnummer</Todo><br />
              <Todo>PLZ Ort</Todo><br />
              E-Mail: datenschutz@diaiway.com<br />
              Tel.: <Todo>Telefonnummer</Todo>
            </div>
            <p>
              Datenschutzbeauftragter (sofern gem. Art. 37 DSGVO / § 38 BDSG erforderlich):{" "}
              <Todo>
                Name und Kontaktdaten des DSB — oder: „Es besteht keine gesetzliche Pflicht zur
                Benennung eines Datenschutzbeauftragten." (zutreffendes wählen)
              </Todo>
            </p>
          </Section>

          <Section num={2} title="Erhobene personenbezogene Daten">
            <p>Wir verarbeiten folgende Kategorien personenbezogener Daten:</p>
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li><strong className="text-foreground">Stammdaten:</strong> Name, E-Mail-Adresse (bei Registrierung)</li>
              <li><strong className="text-foreground">Profilbild:</strong> optional, vom Nutzer hochgeladen (Vercel Blob)</li>
              <li><strong className="text-foreground">Buchungsdaten:</strong> Datum, Uhrzeit, Gesprächspartner, Preis, Notizen</li>
              <li><strong className="text-foreground">Zahlungsdaten:</strong> werden direkt von Stripe verarbeitet; wir speichern nur Stripe-Referenzen</li>
              <li><strong className="text-foreground">Kommunikation:</strong> Direktnachrichten zwischen Nutzern auf der Plattform</li>
              <li><strong className="text-foreground">Session-Daten:</strong> Session-Dauer, Buchungsverknüpfung</li>
              <li><strong className="text-foreground">KI-Interaktionen:</strong> Eingaben im AI-Guide, verarbeitet durch <Todo>KI-Anbieter eintragen (z.B. OpenAI / Vercel AI)</Todo></li>
              <li><strong className="text-foreground">Technische Daten:</strong> IP-Adresse, Browser-Typ, Geräteinformationen, Zugriffszeitpunkte</li>
              <li><strong className="text-foreground">Nutzungsanalyse:</strong> aggregierte Nutzungsdaten via Vercel Analytics</li>
            </ul>
          </Section>

          <Section num={3} title="Zweck und Rechtsgrundlage der Verarbeitung">
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Zweck</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Rechtsgrundlage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[
                    ["Registrierung & Kontoverwaltung", "Art. 6 I b DSGVO (Vertragserfüllung)"],
                    ["Buchungsabwicklung", "Art. 6 I b DSGVO"],
                    ["Zahlungsabwicklung (Stripe)", "Art. 6 I b DSGVO"],
                    ["Sicherheit & Betrugsprävention", "Art. 6 I f DSGVO (berechtigte Interessen)"],
                    ["Steuerliche Aufbewahrungspflichten", "Art. 6 I c DSGVO (rechtliche Verpflichtung)"],
                    ["Plattformverbesserung / Analyse", "Art. 6 I f DSGVO"],
                    ["Marketing-E-Mails (optional)", "Art. 6 I a DSGVO (Einwilligung)"],
                    ["Sessions (Beratung)", "Art. 6 I b DSGVO"],
                    ["KI-Guide-Nutzung", "Art. 6 I b / f DSGVO"],
                  ].map(([z, r]) => (
                    <tr key={z}>
                      <td className="px-3 py-2">{z}</td>
                      <td className="px-3 py-2 text-foreground/70">{r}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section num={4} title="Cookies und Tracking (§ 25 TDDDG)">
            <p>
              Die Plattform verwendet technisch notwendige Cookies für Authentifizierung und Session-Management
              (z.B. NextAuth-Session-Cookie). Diese Cookies erfordern keine Einwilligung gem. § 25 Abs. 2 TDDDG.
            </p>
            <p>
              Wir nutzen <strong className="text-foreground">Vercel Analytics</strong> zur Analyse des
              Nutzerverhaltens. Vercel Analytics ist datenschutzfreundlich konfiguriert (keine Cookies,
              keine personenbezogene IP-Speicherung).{" "}
              <Todo>
                Prüfen und anpassen: Falls Vercel Analytics doch Cookies setzt oder vollständige IPs
                speichert, ist eine Einwilligungslösung (Cookie-Banner) gem. § 25 TDDDG erforderlich.
              </Todo>
            </p>
            <p>
              <Todo>
                Falls weitere Tracking-Tools eingesetzt werden (z.B. Google Analytics, Hotjar, Meta Pixel),
                hier vollständig aufführen und Cookie-Consent-Lösung implementieren.
              </Todo>
            </p>
          </Section>

          <Section num={5} title="Drittanbieter und Auftragsverarbeiter (Art. 28 DSGVO)">
            <p>
              Mit allen nachfolgend genannten Dienstleistern bestehen Auftragsverarbeitungsverträge (AVV)
              gemäß Art. 28 DSGVO.
            </p>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Anbieter</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Zweck</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground">Sitz / Übertragungsmechanismus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[
                    ["Vercel, Inc.", "Hosting, Edge-Netzwerk, Analytics", "USA – SCCs (Art. 46 DSGVO)"],
                    ["Neon / Prisma Data", "PostgreSQL-Datenbankhosting", "USA – SCCs"],
                    ["Stripe Payments Europe", "Zahlungsabwicklung", "Irland (EU) – keine Übermittlung"],
                    ["Daily.co (Daily Videoconferencing)", "Video-Infrastruktur", "USA – SCCs"],
                    ["Vercel Blob (via AWS S3)", "Bildspeicherung", "USA – SCCs"],
                  ].map(([a, z, s]) => (
                    <tr key={a}>
                      <td className="px-3 py-2 font-medium text-foreground">{a}</td>
                      <td className="px-3 py-2">{z}</td>
                      <td className="px-3 py-2">{s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs">
              <Todo>
                KI-Anbieter ergänzen (z.B. OpenAI, Inc., USA – SCCs) mit genauer Beschreibung,
                welche Eingaben übermittelt werden.
              </Todo>
            </p>
            <p className="text-xs">
              <Todo>
                E-Mail-Versand: SMTP-Anbieter eintragen (z.B. Nodemailer via Gmail/SMTP – Google LLC, USA, SCCs).
              </Todo>
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
              ⚠ Drittlandübermittlungen (USA) erfordern seit dem Schrems-II-Urteil (EuGH C-311/18) den
              Nachweis geeigneter Garantien. SCCs allein können ggf. nicht ausreichen – TIA (Transfer
              Impact Assessment) empfohlen.
            </div>
          </Section>

          <Section num={6} title="Video-Sessions (Daily.co)">
            <p>
              Während einer Live-Video-Session werden Audio- und Videodaten in Echtzeit zwischen den
              Teilnehmern übertragen. Die Übertragung erfolgt über die Infrastruktur von Daily.co (USA).
              <strong className="text-foreground"> Sitzungsinhalte werden von diAiway nicht aufgezeichnet oder gespeichert.</strong>
            </p>
            <p>
              Verbindungsmetadaten (Session-Dauer, Zeitstempel) werden für Abrechnungszwecke gespeichert
              (Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO).
            </p>
            <p>
              <Todo>
                Falls Nutzer selbst Aufnahmen machen können (Daily.co Recording-Feature): gesondert
                regeln und Einwilligung der anderen Teilnehmer sicherstellen.
              </Todo>
            </p>
          </Section>

          <Section num={7} title="KI-Verarbeitung (AI-Guide)">
            <p>
              Die Plattform nutzt einen KI-gestützten Assistenten (AI-Guide), der Nutzereingaben
              analysiert, um passende Takumi-Experten zu empfehlen.
            </p>
            <p>
              Dabei werden Texteingaben sowie ggf. hochgeladene Bilder an{" "}
              <Todo>KI-Anbieter eintragen (z.B. OpenAI, Inc., USA)</Todo> übermittelt.
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b / f DSGVO.
            </p>
            <p>
              <strong className="text-foreground">Automatisierte Einzelentscheidungen (Art. 22 DSGVO):</strong>{" "}
              <Todo>
                Prüfen: Trifft der AI-Guide automatisch Entscheidungen mit rechtlicher Wirkung?
                Falls ja: Opt-out-Möglichkeit und menschliche Überprüfung sicherstellen.
              </Todo>
            </p>
          </Section>

          <Section num={8} title="Speicherdauer">
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li>Kontodaten: bis zur Kontolöschung, danach unverzüglich</li>
              <li>Buchungs- und Zahlungsdaten: 10 Jahre (§ 147 AO, § 257 HGB)</li>
              <li>Server-Logs (IP-Adressen): max. 7 Tage, danach anonymisiert</li>
              <li>Direktnachrichten: bis zur Kontolöschung</li>
              <li>
                Profilbilder:{" "}
                <Todo>Speicherdauer für Vercel Blob nach Kontolöschung prüfen und festlegen</Todo>
              </li>
            </ul>
          </Section>

          <Section num={9} title="Minderjährige (Art. 8 DSGVO)">
            <p>
              Die Plattform richtet sich nicht an Kinder unter{" "}
              <Todo>16 (oder 18, je nach Entscheidung in § 2 AGB) Jahren</Todo>.
              Wir erheben wissentlich keine personenbezogenen Daten von Minderjährigen. Wenn uns bekannt
              wird, dass ein Minderjähriger Daten übermittelt hat, löschen wir diese unverzüglich.
            </p>
          </Section>

          <Section num={10} title="Ihre Rechte (Art. 15–21 DSGVO)">
            <p>Sie haben das Recht auf:</p>
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li><strong className="text-foreground">Auskunft</strong> über verarbeitete Daten (Art. 15)</li>
              <li><strong className="text-foreground">Berichtigung</strong> unrichtiger Daten (Art. 16)</li>
              <li><strong className="text-foreground">Löschung</strong> („Recht auf Vergessenwerden", Art. 17)</li>
              <li><strong className="text-foreground">Einschränkung</strong> der Verarbeitung (Art. 18)</li>
              <li><strong className="text-foreground">Datenübertragbarkeit</strong> in maschinenlesbarem Format (Art. 20)</li>
              <li><strong className="text-foreground">Widerspruch</strong> gegen berechtigte Interessen und Direktwerbung (Art. 21)</li>
              <li><strong className="text-foreground">Widerruf</strong> einer Einwilligung jederzeit mit Wirkung für die Zukunft (Art. 7 Abs. 3)</li>
            </ul>
            <p>
              Anfragen richten Sie an: <a href="mailto:datenschutz@diaiway.com" className="text-primary underline underline-offset-2">datenschutz@diaiway.com</a>
            </p>
            <p>
              Wir antworten in der Regel innerhalb von <strong className="text-foreground">30 Tagen</strong>{" "}
              (gesetzliche Frist gemäß Art. 12 Abs. 3 DSGVO).
            </p>
          </Section>

          <Section num={11} title="Beschwerderecht (Art. 77 DSGVO)">
            <p>
              Sie haben das Recht, sich bei der zuständigen Datenschutz-Aufsichtsbehörde zu beschweren.
              Zuständig ist die Behörde des Bundeslandes, in dem wir unseren Sitz haben:
            </p>
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <Todo>Name der Landesbehörde, z.B. „Berliner Beauftragte für Datenschutz und Informationsfreiheit"</Todo><br />
              <Todo>Adresse der Behörde</Todo><br />
              <Todo>Website der Behörde</Todo>
            </div>
          </Section>

          <Section num={12} title="Sicherheit der Datenverarbeitung (Art. 32 DSGVO)">
            <p>
              Wir setzen technische und organisatorische Maßnahmen ein, um Ihre Daten zu schützen:
            </p>
            <ul className="ml-4 flex list-disc flex-col gap-1">
              <li>HTTPS-Verschlüsselung aller Verbindungen (TLS 1.2+)</li>
              <li>Passwort-Hashing mit bcrypt (Saltfaktor ≥ 10)</li>
              <li>Rate-Limiting auf Authentifizierungsendpunkten</li>
              <li>Honeypot-Schutz gegen automatisierte Angriffe</li>
              <li>Regelmäßige Sicherheitsupdates der Abhängigkeiten</li>
              <li><Todo>Weitere Maßnahmen ergänzen (z.B. 2FA, Penetrationstests, Zugriffsprotokollierung)</Todo></li>
            </ul>
          </Section>

          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
            Stand: <Todo>Datum einsetzen</Todo> · Diese Datenschutzerklärung ist ein erweiterter Platzhalter
            auf Basis der DSGVO, des TDDDG und des DSA. Sie ersetzt keine anwaltliche Prüfung.
            Vor dem Live-Gang durch einen Datenschutzexperten abnehmen lassen.
          </div>

        </div>
      </main>
    </div>
  )
}

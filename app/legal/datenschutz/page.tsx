import { Mail, Phone, Building2, Shield } from "lucide-react"
import { LegalSubpageHeader } from "@/components/app-subpage-header"

export const metadata = { title: "Datenschutz – diAIway" }

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mb-2">{children}</h3>
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-foreground/90 mt-4 mb-1">{children}</h4>
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:text-primary/90 break-all"
    >
      {children}
    </a>
  )
}

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-8 pb-safe min-w-0">

        <LegalSubpageHeader variant="privacy" className="mb-8" />

        <div className="flex flex-col gap-8">

          {/* Verantwortlicher */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
              Verantwortliche Stelle
            </h2>
            <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <span className="font-bold text-foreground text-lg">JM faircharge UG (haftungsbeschränkt)</span>
              <span className="text-muted-foreground">Esmarchstraße 13</span>
              <span className="text-muted-foreground">10407 Berlin</span>
              <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-3 text-sm text-foreground/80">
                <Building2 className="size-4 text-primary" />
                <span>Vertreten durch: <strong className="text-foreground">Jens Möllenkamp</strong></span>
              </div>
            </div>
          </section>

          {/* Kontakt Datenschutz */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
              Kontakt bei Datenschutzanfragen
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground">Telefon</span>
                  <a href="tel:+4917681182794" className="text-sm font-medium hover:underline">+49 176 81182794</a>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/30">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground">E-Mail</span>
                  <a href="mailto:jm@faircharge.com" className="text-sm font-medium hover:underline">jm@faircharge.com</a>
                </div>
              </div>
            </div>
          </section>

          {/* Datenschutz-Inhalte */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
              <Shield className="size-4" />
              Datenschutzerklärung
            </h2>
            <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground leading-relaxed space-y-6">

              {/* 1 */}
              <div>
                <SectionHeading>1. Geltungsbereich</SectionHeading>
                <p>
                  Diese Datenschutzerklärung gilt für die Nutzung der Plattform diAIway in allen verfügbaren Formen:
                  die Web-Applikation unter <ExternalLink href="https://diaiway.com">diaiway.com</ExternalLink>, die
                  iOS-App (App Store) sowie die Android-App (Google Play Store). Betreiberin aller Plattformen ist
                  die JM faircharge UG (haftungsbeschränkt), Esmarchstraße 13, 10407 Berlin.
                </p>
              </div>

              {/* 2 */}
              <div>
                <SectionHeading>2. Erhobene Daten &amp; Zwecke</SectionHeading>

                <SubHeading>2.1 Registrierung &amp; Konto</SubHeading>
                <p>
                  Bei der Registrierung erheben wir Name, E-Mail-Adresse und ein gehashtes Passwort. Zusätzlich
                  werden Zustimmungszeitpunkte und -versionen für AGB, Datenschutzerklärung sowie ggf. Marketing-Opt-in
                  gespeichert. IP-Adressen werden ausschließlich als SHA-256-Hash (mit serverseitigem Pepper)
                  gespeichert – niemals im Klartext.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO
                  (Vertragserfüllung), Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung –
                  Nachweis der Einwilligung).
                </p>

                <SubHeading>2.2 Profil &amp; Nutzerdaten</SubHeading>
                <p>
                  Profilbild, Benutzername, Biografie (bei Takumis), Spracheinstellungen, Skill-Level (bei Shugyo),
                  Social-Media-Links (freiwillig) sowie Portfolio-Projekte. Diese Daten werden auf unseren Servern
                  gespeichert und – soweit öffentlich – anderen Nutzern der Plattform angezeigt.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO,
                  Art. 6 Abs. 1 lit. a DSGVO (bei freiwilligen Angaben).
                </p>

                <SubHeading>2.3 Buchungen &amp; Sessions</SubHeading>
                <p>
                  Buchungsdatum, Uhrzeit, Buchungsart (geplant / Instant), Anruftyp (Video / Audio), Buchungsstatus,
                  Session-Dauer, Bewertungen und Rezensionen sowie ggf. eine kurze Buchungsnotiz.
                  Bei Gast-Buchungen wird eine temporäre E-Mail-Adresse und ein einmaliges Token verwendet.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.
                </p>

                <SubHeading>2.4 Zahlungsdaten</SubHeading>
                <p>
                  Zahlungen werden über Stripe, Inc. (1 Global Place, 25th Floor, New York, NY 10004, USA) abgewickelt.
                  Wir speichern keine vollständigen Kartendaten. Auf unseren Servern werden lediglich
                  Stripe-Session-IDs, Stripe-Payment-Intent-IDs, Betrag (in Cent) und Zahlungsstatus gespeichert.
                  Rechnungsdaten (Name, Adresse, ggf. USt-IdNr.) werden für die Erstellung von PDF-Belegen
                  verarbeitet und gespeichert.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO,
                  Art. 6 Abs. 1 lit. c DSGVO (handels- und steuerrechtliche Aufbewahrungspflichten, §§ 147 AO, 257 HGB –
                  Aufbewahrungsfrist: 10 Jahre).
                </p>
                <p className="mt-2">
                  Stripe-Datenschutzerklärung:{" "}
                  <ExternalLink href="https://stripe.com/de/privacy">stripe.com/de/privacy</ExternalLink>
                </p>

                <SubHeading>2.5 Wallet &amp; Transaktionen</SubHeading>
                <p>
                  Walletguthaben (in Cent), Transaktionsart (Aufladung, Buchungsabzug, Rückerstattung, Auszahlung)
                  und zugehörige Referenzen (Buchungs-ID, Stripe-Session-ID) werden zur Abrechnung und
                  Konfliktlösung protokolliert.
                </p>

                <SubHeading>2.6 Kommunikation (Chat &amp; Waymails)</SubHeading>
                <p>
                  Direktnachrichten (Chat) und asynchrone Nachrichten (Waymail) zwischen Nutzern werden auf unseren
                  Servern gespeichert, um die Kommunikation innerhalb der Plattform zu ermöglichen.
                  Anhänge (Bilder, Dateien) werden in Vercel Blob gespeichert.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.
                </p>

                <SubHeading>2.7 Push-Benachrichtigungen</SubHeading>
                <p>
                  <strong className="text-foreground">Web:</strong> Browser-Push über die Web Push API
                  (Endpunkt, öffentlicher Schlüssel, Auth-Secret).{" "}
                  <strong className="text-foreground">iOS &amp; Android:</strong> Firebase Cloud Messaging (FCM)
                  bzw. Apple Push Notification Service (APNs) – hierfür wird ein Gerätetoken
                  (FCM-Token) gespeichert.
                  Push-Benachrichtigungen können jederzeit in den Systemeinstellungen deaktiviert werden.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO
                  (Einwilligung durch Aktivierung im Betriebssystem).
                </p>

                <SubHeading>2.8 KI-Assistent (AI Guide)</SubHeading>
                <p>
                  Eingaben im KI-Assistenten werden zur Verarbeitung und Beantwortung an unseren
                  KI-Dienst weitergeleitet. Es erfolgt keine dauerhafte personenbezogene Speicherung
                  der Konversationsinhalte über die Sitzung hinaus, sofern dies nicht zur Bereitstellung
                  der Funktion technisch notwendig ist.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO.
                </p>

                <SubHeading>2.9 Sicherheits- &amp; Moderationsdaten</SubHeading>
                <p>
                  Im Rahmen unseres Safety-Systems können bei begründetem Verdacht auf Richtlinienverstöße
                  während einer laufenden Video-Session stichprobenartige Snapshots erstellt werden.
                  Nutzer werden vor Session-Start auf diese Möglichkeit hingewiesen und müssen ihr zustimmen
                  (Einwilligung per Checkbox).
                  Snapshot-Bilder werden in Vercel Blob gespeichert und nach Abschluss der Prüfung gelöscht.
                  Safety-Reports (Meldungen durch andere Nutzer) werden inkl. Kategorie und Freitext gespeichert.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO
                  (Snapshot-Einwilligung), Art. 6 Abs. 1 lit. f DSGVO (Safety-Reports, berechtigtes Interesse
                  an Plattformsicherheit).
                </p>

                <SubHeading>2.10 Nutzungsanalyse (Web)</SubHeading>
                <p>
                  Wir betreiben eine eigene, datenschutzfreundliche Nutzungsanalyse ohne Einsatz von
                  Drittanbieter-Tracking-Tools. Dabei wird eine anonyme Besucher-ID (im LocalStorage des Browsers)
                  gespeichert. Erhoben werden: aufgerufene Seiten, Sitzungsdauer, Einstiegsseite, Referrer (vorherige
                  Website) sowie User-Agent. Es werden keine personenbezogenen Daten ohne Einwilligung an
                  Drittanbieter übermittelt.
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO
                  (berechtigtes Interesse an der Verbesserung des Angebots).
                </p>
              </div>

              {/* 3 */}
              <div>
                <SectionHeading>3. App-Berechtigungen</SectionHeading>

                <SubHeading>3.1 Kamera</SubHeading>
                <p>
                  <strong className="text-foreground">iOS &amp; Android:</strong> Für Video-Consultations zwischen
                  Shugyo und Takumi sowie zum Hochladen von Profilbildern und Projekten.
                  Bilddaten werden ausschließlich live übertragen oder – auf Ihre Initiative hin – als Profilbild
                  auf unseren Servern gespeichert. Eine serverseitige Aufzeichnung von Video-Sessions findet
                  nicht statt.
                </p>

                <SubHeading>3.2 Mikrofon</SubHeading>
                <p>
                  Für Audio-Übertragung bei Video- und Voice-Calls. Audiodaten werden nicht aufgezeichnet
                  oder gespeichert.
                </p>

                <SubHeading>3.3 Fotobibliothek / Medienzugriff</SubHeading>
                <p>
                  <strong className="text-foreground">iOS:</strong> Fotobibliothek (NSPhotoLibraryUsageDescription) –
                  zum Hochladen von Profilbildern und Projektfotos.{" "}
                  <strong className="text-foreground">Android:</strong> READ_MEDIA_IMAGES (Android 13+) bzw.
                  READ_EXTERNAL_STORAGE (bis Android 12) – gleicher Zweck.
                  Ausgewählte Bilder werden auf Ihre Initiative hin in Vercel Blob (EU-Region) gespeichert.
                </p>

                <SubHeading>3.4 Biometrie / Face ID</SubHeading>
                <p>
                  <strong className="text-foreground">iOS:</strong> Face ID (NSFaceIDUsageDescription) –
                  für sichere Anmeldung und Datenschutz auf dem Gerät. Biometrische Daten verlassen niemals
                  das Gerät und werden nicht an unsere Server übertragen. Die Verarbeitung erfolgt
                  ausschließlich durch das Betriebssystem (Secure Enclave).
                </p>
                <p className="mt-2">
                  <strong className="text-foreground">Android:</strong> USE_BIOMETRIC – gleichwertiger Schutz
                  über den Android BiometricPrompt.
                </p>

                <SubHeading>3.5 Benachrichtigungen</SubHeading>
                <p>
                  POST_NOTIFICATIONS (Android 13+) bzw. UNUserNotificationCenter (iOS) –
                  für Buchungsbestätigungen, Erinnerungen und Nachrichten.
                  Die Berechtigung kann jederzeit in den Systemeinstellungen widerrufen werden.
                </p>

                <SubHeading>3.6 Exakte Alarme / Erinnerungen (Android)</SubHeading>
                <p>
                  SCHEDULE_EXACT_ALARM (bis Android 12) / USE_EXACT_ALARM (Android 13+) –
                  für pünktliche Session-Erinnerungen. Es werden keine personenbezogenen Daten an Dritte
                  übermittelt.
                </p>

                <p className="mt-4 italic">
                  Alle Berechtigungen können jederzeit unter <strong className="text-foreground not-italic">Einstellungen → Apps → diAIway → Berechtigungen</strong> (Android)
                  bzw. <strong className="text-foreground not-italic">Einstellungen → Datenschutz</strong> (iOS) widerrufen werden.
                  Die grundlegenden Funktionen bleiben erhalten; lediglich die jeweilige Funktion steht dann nicht zur Verfügung.
                </p>
              </div>

              {/* 4 */}
              <div>
                <SectionHeading>4. Drittanbieter &amp; Datenübermittlungen</SectionHeading>

                <SubHeading>4.1 Stripe (Zahlungsabwicklung)</SubHeading>
                <p>
                  Stripe, Inc., 1 Global Place, 25th Floor, New York, NY 10004, USA –
                  Stripe ist für Zahlungen und (bei Takumis) für Connect-Auszahlungen verantwortlich.
                  Datenübermittlung in die USA auf Basis von Standardvertragsklauseln (SCC) gem. Art. 46 DSGVO.{" "}
                  <ExternalLink href="https://stripe.com/de/privacy">stripe.com/de/privacy</ExternalLink>
                </p>

                <SubHeading>4.2 Google Firebase / FCM (Android-Push)</SubHeading>
                <p>
                  Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA –
                  Firebase Cloud Messaging für Push-Benachrichtigungen auf Android-Geräten.
                  Datenübermittlung in die USA auf Basis von SCC.{" "}
                  <ExternalLink href="https://policies.google.com/privacy">policies.google.com/privacy</ExternalLink>
                </p>

                <SubHeading>4.3 Apple APNs (iOS-Push)</SubHeading>
                <p>
                  Apple Inc., One Apple Park Way, Cupertino, CA 95014, USA –
                  Apple Push Notification Service für Push-Benachrichtigungen auf iOS-Geräten.{" "}
                  <ExternalLink href="https://www.apple.com/legal/privacy/de-ww/">apple.com/legal/privacy</ExternalLink>
                </p>

                <SubHeading>4.4 Google Play-Dienste (Android)</SubHeading>
                <p>
                  Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland –
                  Google Play-Dienste ermöglichen grundlegende Android-Funktionen (Sicherheits-Updates,
                  App-Stabilität). Dabei können Analysedaten erhoben werden.{" "}
                  <ExternalLink href="https://policies.google.com/privacy">policies.google.com/privacy</ExternalLink>
                </p>

                <SubHeading>4.5 Daily.co (Video-Sessions)</SubHeading>
                <p>
                  Daily.co (Daily, Inc., 530 Lytton Ave, Palo Alto, CA 94301, USA) –
                  Bereitstellung von verschlüsselten Video-/Audio-Räumen für Buchungen.
                  Sessions werden nicht aufgezeichnet. Verbindungsdaten (IP-Adressen) können
                  temporär verarbeitet werden.{" "}
                  <ExternalLink href="https://www.daily.co/privacy">daily.co/privacy</ExternalLink>
                </p>

                <SubHeading>4.6 Vercel &amp; Vercel Blob (Hosting &amp; Speicher)</SubHeading>
                <p>
                  Vercel, Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA –
                  Hosting der Web-App und Speicherung von Medien (Profilbilder, Projektfotos,
                  Sicherheits-Snapshots, Dokument-PDFs). Datentransfers in die USA auf Basis von SCC.{" "}
                  <ExternalLink href="https://vercel.com/legal/privacy-policy">vercel.com/legal/privacy-policy</ExternalLink>
                </p>

                <SubHeading>4.7 Neon (Datenbank)</SubHeading>
                <p>
                  Neon, Inc. (PostgreSQL-Datenbankdienst) – Speicherung aller strukturierten Daten
                  (Nutzerprofile, Buchungen, Transaktionen etc.) auf Basis eines Auftragsverarbeitungsvertrags
                  (AVV) gem. Art. 28 DSGVO.
                </p>
              </div>

              {/* 5 */}
              <div>
                <SectionHeading>5. Datenspeicherung &amp; Löschung</SectionHeading>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="text-foreground">Kontodaten:</strong> Bis zur Löschung des Nutzerkontos
                    auf Anfrage; sofern keine gesetzliche Aufbewahrungspflicht entgegensteht.
                  </li>
                  <li>
                    <strong className="text-foreground">Rechnungen &amp; Transaktionsdaten:</strong> 10 Jahre
                    (§§ 147 AO, 257 HGB).
                  </li>
                  <li>
                    <strong className="text-foreground">Sicherheits-Snapshots:</strong> Werden nach Abschluss
                    der Prüfung gelöscht; bei laufenden Verfahren bis zur Klärung aufbewahrt.
                  </li>
                  <li>
                    <strong className="text-foreground">Push-Tokens:</strong> Werden bei Abmeldung oder
                    Kontolöschung automatisch entfernt.
                  </li>
                  <li>
                    <strong className="text-foreground">Nutzungsanalyse:</strong> Anonyme Daten ohne
                    Personenbezug; keine gesetzliche Löschfrist.
                  </li>
                </ul>
              </div>

              {/* 6 */}
              <div>
                <SectionHeading>6. Datensicherheit</SectionHeading>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Alle Übertragungen erfolgen verschlüsselt über HTTPS/TLS.</li>
                  <li>Passwörter werden ausschließlich gehasht (bcrypt) gespeichert, niemals im Klartext.</li>
                  <li>IP-Adressen werden nur als SHA-256-Hash mit serverseitigem Pepper gespeichert.</li>
                  <li>
                    JWT-Tokens können serverseitig invalidiert werden
                    (tokenRevocationTime per Nutzer-Datensatz).
                  </li>
                  <li>Video-Räume werden von Daily.co per Ende-zu-Ende-Verschlüsselung abgesichert.</li>
                  <li>
                    Zugriffsrechte folgen dem Least-Privilege-Prinzip;
                    Admin-Funktionen sind rollenbasiert geschützt.
                  </li>
                </ul>
              </div>

              {/* 7 */}
              <div>
                <SectionHeading>7. Ihre Rechte (Art. 15–22 DSGVO)</SectionHeading>
                <ul className="list-disc space-y-2 pl-5">
                  <li><strong className="text-foreground">Auskunft</strong> über gespeicherte Daten (Art. 15 DSGVO).</li>
                  <li><strong className="text-foreground">Berichtigung</strong> unrichtiger Daten (Art. 16 DSGVO).</li>
                  <li><strong className="text-foreground">Löschung</strong> (Recht auf Vergessenwerden, Art. 17 DSGVO).</li>
                  <li><strong className="text-foreground">Einschränkung</strong> der Verarbeitung (Art. 18 DSGVO).</li>
                  <li><strong className="text-foreground">Datenübertragbarkeit</strong> (Art. 20 DSGVO).</li>
                  <li><strong className="text-foreground">Widerspruch</strong> gegen die Verarbeitung (Art. 21 DSGVO).</li>
                  <li>
                    <strong className="text-foreground">Widerruf</strong> einer erteilten Einwilligung
                    jederzeit und ohne Angabe von Gründen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).
                  </li>
                  <li>
                    <strong className="text-foreground">Beschwerde</strong> bei einer zuständigen
                    Datenschutz-Aufsichtsbehörde, z.&nbsp;B.{" "}
                    <ExternalLink href="https://www.datenschutz-berlin.de">
                      Berliner Beauftragte für Datenschutz und Informationsfreiheit
                    </ExternalLink>.
                  </li>
                </ul>
                <p className="mt-3">
                  Zur Ausübung Ihrer Rechte wenden Sie sich an:{" "}
                  <a href="mailto:jm@faircharge.com" className="font-medium text-primary underline underline-offset-2 hover:text-primary/90">
                    jm@faircharge.com
                  </a>
                </p>
              </div>

              {/* 8 */}
              <div>
                <SectionHeading>8. Cookies &amp; lokaler Speicher</SectionHeading>
                <p>
                  Die Web-App setzt technisch notwendige Cookies für die Authentifizierung (Session-Token)
                  sowie LocalStorage-Einträge für Spracheinstellung und anonyme Besucher-ID (Nutzungsanalyse).
                  Es werden keine Werbe- oder Tracking-Cookies von Drittanbietern gesetzt.
                </p>
                <p className="mt-2">
                  Die nativen iOS- und Android-Apps verwenden keinen Browser-Cookie-Speicher;
                  App-Einstellungen (z.&nbsp;B. bevorzugte Sprache) werden lokal auf dem Gerät
                  im App-eigenen Speicherbereich abgelegt.
                </p>
              </div>

              {/* 9 */}
              <div>
                <SectionHeading>9. Minderjährige</SectionHeading>
                <p>
                  Die Plattform diAIway richtet sich nicht an Kinder unter 16 Jahren. Wir erheben
                  wissentlich keine personenbezogenen Daten von Minderjährigen. Sollten uns Hinweise
                  darauf vorliegen, werden entsprechende Daten unverzüglich gelöscht.
                </p>
              </div>

              {/* 10 */}
              <div>
                <SectionHeading>10. Änderungen dieser Datenschutzerklärung</SectionHeading>
                <p>
                  Wir behalten uns vor, diese Datenschutzerklärung bei Änderungen der Plattform,
                  gesetzlicher Anforderungen oder eingesetzter Dienste zu aktualisieren.
                  Die jeweils aktuelle Version ist in der App und auf unserer Website abrufbar.
                  Bei wesentlichen Änderungen werden registrierte Nutzer per E-Mail oder
                  In-App-Benachrichtigung informiert.
                </p>
              </div>

            </div>
          </section>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Stand: März 2026 · diAIway Plattform (Web · iOS · Android)
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
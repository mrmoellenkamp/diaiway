import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function DatenschutzPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/" className="flex size-9 items-center justify-center rounded-lg hover:bg-muted">
            <ArrowLeft className="size-5 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Datenschutz</h1>
        </div>
        <div className="flex flex-col gap-5 text-sm text-foreground leading-relaxed">
          <h2 className="text-lg font-bold">Datenschutzerklarung (DSGVO)</h2>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">1. Verantwortlicher</h3>
            <p>Verantwortlich fur die Datenverarbeitung auf dieser Plattform ist die diAiway GmbH, Musterstrasse 42, 10115 Berlin.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">2. Erhebung personenbezogener Daten</h3>
            <p>Wir erheben personenbezogene Daten, wenn Sie sich registrieren, eine Session buchen oder unseren AI-Guide verwenden. Dies umfasst Name, E-Mail-Adresse, Zahlungsinformationen und Session-Verlauf.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">3. Zweck der Verarbeitung</h3>
            <p>Ihre Daten werden zur Bereitstellung unserer Dienste, zur Zahlungsabwicklung und zur Verbesserung der Plattform verarbeitet.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">4. Ihre Rechte</h3>
            <p>Sie haben das Recht auf Auskunft, Berichtigung, Loschung, Einschrankung der Verarbeitung und Datenubertragbarkeit gemass Art. 15-20 DSGVO.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">5. Kontakt</h3>
            <p>Bei Fragen zum Datenschutz wenden Sie sich an: datenschutz@diaiway.de</p>
          </section>

          <p className="text-xs text-muted-foreground mt-4">
            Dies ist eine Demo-Anwendung. Alle Angaben sind fiktiv und dienen nur zu Demonstrationszwecken.
          </p>
        </div>
      </main>
    </div>
  )
}

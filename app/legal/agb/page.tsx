import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function AGBPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/" className="flex size-9 items-center justify-center rounded-lg hover:bg-muted">
            <ArrowLeft className="size-5 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">AGB</h1>
        </div>
        <div className="flex flex-col gap-5 text-sm text-foreground leading-relaxed">
          <h2 className="text-lg font-bold">Allgemeine Geschaftsbedingungen</h2>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">1. Geltungsbereich</h3>
            <p>Diese AGB gelten fur alle uber die Plattform diAiway vermittelten Dienstleistungen zwischen Shugyo (Lernenden) und Takumi (Experten).</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">2. Leistungsbeschreibung</h3>
            <p>diAiway vermittelt Live-Video-Beratungen zwischen Experten und Nutzern. Die ersten 5 Minuten jeder Session sind kostenlos. Danach wird der vereinbarte Preis fallig.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">3. Zahlungsbedingungen</h3>
            <p>Zahlungen werden uber unser Escrow-System abgewickelt. Der Betrag wird vorab autorisiert und erst nach Freigabe durch den Shugyo an den Takumi ausgezahlt. diAiway erhalt eine Provision von 15%.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">4. Stornierung</h3>
            <p>Sessions konnen bis zu 1 Stunde vor Beginn kostenlos storniert werden. Bei spaterer Stornierung wird eine Gebuhr von 50% des Session-Preises erhoben.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">5. Haftungsausschluss</h3>
            <p>diAiway haftet nicht fur die Qualitat der von Takumis erbrachten Beratungsleistungen. Die Plattform fungiert ausschliesslich als Vermittler.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">6. Missbrauchsmeldung</h3>
            <p>Nutzer konnen unangemessenes Verhalten wahrend oder nach einer Session melden. diAiway behalt sich das Recht vor, Nutzer bei Verstossen auszuschliessen.</p>
          </section>

          <p className="text-xs text-muted-foreground mt-4">
            Dies ist eine Demo-Anwendung. Alle Angaben sind fiktiv und dienen nur zu Demonstrationszwecken.
          </p>
        </div>
      </main>
    </div>
  )
}

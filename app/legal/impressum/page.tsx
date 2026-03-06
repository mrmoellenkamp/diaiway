import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ImpressumPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/" className="flex size-9 items-center justify-center rounded-lg hover:bg-muted">
            <ArrowLeft className="size-5 text-foreground" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Impressum</h1>
        </div>
        <div className="flex flex-col gap-4 text-sm text-foreground leading-relaxed">
          <h2 className="text-lg font-bold">Angaben gemass 5 TMG</h2>
          <div>
            <p className="font-semibold">diAiway GmbH</p>
            <p>Musterstrasse 42</p>
            <p>10115 Berlin</p>
            <p>Deutschland</p>
          </div>
          <div>
            <p className="font-semibold">Vertreten durch:</p>
            <p>Max Mustermann, Geschaftsfuhrer</p>
          </div>
          <div>
            <p className="font-semibold">Kontakt:</p>
            <p>Telefon: +49 (0) 30 1234567</p>
            <p>E-Mail: kontakt@diaiway.de</p>
          </div>
          <div>
            <p className="font-semibold">Handelsregister:</p>
            <p>Registergericht: Amtsgericht Berlin-Charlottenburg</p>
            <p>Registernummer: HRB 123456</p>
          </div>
          <div>
            <p className="font-semibold">Umsatzsteuer-ID:</p>
            <p>DE123456789</p>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Dies ist eine Demo-Anwendung. Alle Angaben sind fiktiv.
          </p>
        </div>
      </main>
    </div>
  )
}

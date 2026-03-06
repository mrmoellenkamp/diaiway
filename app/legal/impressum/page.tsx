import Link from "next/link"
import { ArrowLeft, Construction, Mail, MapPin, Phone, Building2 } from "lucide-react"

export const metadata = { title: "Impressum – diAiway" }

export default function ImpressumPage() {
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
          <h1 className="text-lg font-semibold text-foreground">Impressum</h1>
        </div>

        {/* Placeholder notice */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <Construction className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Platzhalter – </span>
            Diese Seite enthält noch keine rechtsverbindlichen Angaben. Die folgenden Informationen müssen vor dem Live-Gang durch korrekte Daten ersetzt werden.
          </p>
        </div>

        <div className="flex flex-col gap-6 text-sm text-foreground leading-relaxed">

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Angaben gemäß § 5 TMG</h2>
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold">diAiway</p>
                  <p className="text-muted-foreground">[Rechtsform, z.B. GmbH, UG, Einzelunternehmen]</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="text-muted-foreground">
                  <p>[Straße und Hausnummer]</p>
                  <p>[PLZ] [Ort]</p>
                  <p>Deutschland</p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Vertreten durch</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <p>[Name des/der Geschäftsführer(s)]</p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Kontakt</h2>
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Phone className="size-4 shrink-0" />
                <span>[Telefonnummer]</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="size-4 shrink-0" />
                <span>kontakt@diaiway.com</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Handelsregister</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <p>Registergericht: [Amtsgericht]</p>
              <p>Registernummer: [HRB / HR-Nummer]</p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Umsatzsteuer-ID</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:</p>
              <p>[USt-ID]</p>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4 text-muted-foreground">
              <p>[Name]</p>
              <p>[Adresse wie oben]</p>
            </div>
          </section>

          <div className="mt-2 rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
            Stand: [Datum einsetzen] · Alle in eckigen Klammern stehenden Angaben sind Platzhalter.
          </div>
        </div>
      </main>
    </div>
  )
}

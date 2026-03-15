import Link from "next/link"
import { ArrowLeft, Mail, Phone, Building2, Shield } from "lucide-react"

export const metadata = { title: "Datenschutz – diAIway" }

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-8 pb-safe min-w-0">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/profile"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card transition-colors hover:bg-muted"
            aria-label="Zurück"
          >
            <ArrowLeft className="size-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Datenschutz</h1>
            <p className="text-sm text-muted-foreground">Datenschutzerklärung</p>
          </div>
        </div>

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
              Datenschutz
            </h2>
            <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground leading-relaxed space-y-4">
              <p>
                Wir erheben und verarbeiten personenbezogene Daten ausschließlich im Rahmen der gesetzlichen Bestimmungen (DSGVO, BDSG).
              </p>
              <p>
                <strong className="text-foreground">Zweck:</strong> Bereitstellung der Plattform diAIway, Vermittlung von Experten und Lernenden, Abwicklung von Buchungen und Zahlungen.
              </p>
              <p>
                <strong className="text-foreground">Rechtsgrundlage:</strong> Vertragserfüllung, berechtigtes Interesse, ggf. Einwilligung.
              </p>
              <p>
                <strong className="text-foreground">Ihre Rechte:</strong> Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Aufsichtsbehörde.
              </p>
            </div>
          </section>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Stand: März 2026 · diAIway Plattform
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
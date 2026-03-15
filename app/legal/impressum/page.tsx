import Link from "next/link"
import { ArrowLeft, Mail, Phone, Building2, Globe, Scale } from "lucide-react"

export const metadata = { title: "Impressum – diAIway" }

export default function ImpressumPage() {
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
            <h1 className="text-xl font-bold tracking-tight">Impressum</h1>
            <p className="text-sm text-muted-foreground">Rechtliche Anbieterkennung</p>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          
          {/* Anbieter nach § 5 TMG */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
              Angaben gemäß § 5 TMG
            </h2>
            <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <span className="font-bold text-foreground text-lg">JMfaircharge UG (haftungsbeschränkt)</span>
              <span className="text-muted-foreground">Esmarchstraße 13</span>
              <span className="text-muted-foreground">10407 Berlin</span>
              
              <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-3 text-sm text-foreground/80">
                <Building2 className="size-4 text-primary" />
                <span>Vertreten durch: <strong className="text-foreground">Jens Möllenkamp</strong></span>
              </div>
            </div>
          </section>

          {/* Kontakt */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
              Kontakt
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

          {/* Register & Steuern */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Registereintrag</h2>
              <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                <p>Registergericht: <span className="text-foreground font-medium text-xs">Amtsgericht Berlin (Charlottenburg)</span></p>
                <p className="mt-1">Registernummer: <span className="text-foreground font-medium text-xs">HRB 214163 B</span></p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Umsatzsteuer-ID</h2>
              <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                <p className="text-[10px] uppercase mb-1">Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG:</p>
                <p className="text-foreground font-medium">DE327945253</p>
              </div>
            </div>
          </section>

          {/* Redaktionell Verantwortlich */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
              Redaktionell verantwortlich
            </h2>
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Jens Möllenkamp</p>
              <p>Esmarchstraße 13</p>
              <p>10407 Berlin</p>
            </div>
          </section>

          {/* Streitschlichtung */}
          <section className="flex flex-col gap-4 border-t border-border/60 pt-6">
            <div className="flex items-center gap-2 text-primary">
              <Scale className="size-5" />
              <h2 className="text-base font-bold">Streitschlichtung</h2>
            </div>
            
            <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
              <div className="rounded-2xl bg-muted/30 p-4">
                <p className="font-semibold text-foreground mb-1 italic">EU-Streitschlichtung</p>
                <p>
                  Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
                  <a 
                    href="https://ec.europa.eu/consumers/odr/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline ml-1 inline-flex items-center gap-1"
                  >
                    ec.europa.eu/consumers/odr <Globe className="size-3" />
                  </a>
                </p>
              </div>

              <div className="rounded-2xl bg-muted/30 p-4">
                <p className="font-semibold text-foreground mb-1 italic">Verbraucherstreitbeilegung</p>
                <p>
                  Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
                </p>
              </div>
            </div>
          </section>

          {/* Footer Info */}
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
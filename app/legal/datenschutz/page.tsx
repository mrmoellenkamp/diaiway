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
              <span className="font-bold text-foreground text-lg">JM faircharge UG (haftungsbeschränkt)</span>
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
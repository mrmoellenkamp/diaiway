import Image from "next/image"
import Link from "next/link"
import { Rocket, Mail, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BetaFounderCard } from "@/components/beta/beta-founder-card"
import { BetaLocaleSwitch } from "@/components/beta/beta-locale-switch"
import { getBetaMailto } from "@/lib/beta-mailto"

export function BetaGermanLanding() {
  const mailtoHref = getBetaMailto()

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      {/* Oben: Founder — ganz nach vorn */}
      <section className="relative bg-white pb-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] md:pb-8">
        <div className="absolute right-3 z-20 md:right-6 top-[max(0.5rem,env(safe-area-inset-top,0px))]">
          <BetaLocaleSwitch variant="light" />
        </div>
        <div className="mx-auto flex w-full justify-center px-3 pt-4 sm:px-4 md:pt-5">
          <BetaFounderCard
            label="Founder"
            name="Jens von diAiway"
            imageAlt="Jens, Gründer von diAiway"
          />
        </div>
      </section>

      <article className="mx-auto max-w-2xl px-4 pt-4 pb-8 md:pt-6 md:pb-12">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <Rocket className="size-3.5" aria-hidden />
          Beta-Runde
        </p>
        <h1 className="mt-3 text-balance text-2xl font-bold leading-tight text-stone-900 md:text-4xl">
          Endspurt bei{" "}
          <span className="whitespace-nowrap">
            di<span className="text-primary">Ai</span>way
          </span>
          : Ich brauche deine Hilfe 🚀
        </h1>
        <p className="mt-6 text-lg font-medium leading-relaxed text-stone-800 md:text-xl">Hey!</p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Wer mich kennt, weiß: Ich liebe DIY-Projekte. Neues ausprobieren, Neues lernen, Neues erleben – und am Ende
          stolz darauf sein, was man selbst geschaffen hat.
        </p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          <strong>ABER:</strong> Wie viel Zeit habe ich bitte mit endlosen Recherchen und unsinnigen Forenbeiträgen
          verschwendet? Irre!!! Bestimmt hast du das auch schon mal erlebt. Versteht mich nicht falsch: Es gehört dazu,
          sich durchzukämpfen und Hürden zu meistern. Das macht ein DIY-Projekt aus.
        </p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Die Frage ist nur: Wie sehr muss man sich quälen? Viel zu viele Projekte scheitern, weil der Zugang zu
          Fachwissen fehlt, zu teuer ist oder einfach nicht im Verhältnis zum Projekt steht. Der Frust wächst, der
          Haussegen hängt schief, weil das Boot seit fünf Jahren im Garten steht, und eh man sich versieht, landet die
          „Projektleiche“ als Notverkauf zum Ramschpreis bei Kleinanzeigen.
        </p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Und das nur, weil man nicht weiterwusste? Weil niemand da war, mit dem man sich fachlich austauschen konnte
          oder der einem Mut zugesprochen hat? Das ist doch Mist.
        </p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Seit ein paar Jahren geistert mir daher eine Idee durch den Kopf: Eine Plattform, auf der ich zielgerichtet
          Hilfe für meine Projekte bekomme. Ohne stundenlange Suche, ohne abgewimmelt zu werden, ohne Stress. Einfach
          jemanden fragen, der sich auskennt. Schnell, praktisch, per Telefon oder Video-Call. Egal, ob es nur darum
          geht, ein Möbelstück zusammenzubauen oder einen Oldtimer zu restaurieren.
        </p>

        <div className="mt-8 rounded-2xl border border-primary/15 bg-primary/[0.06] p-5 md:p-6">
          <p className="text-base font-semibold leading-relaxed text-primary md:text-lg">
            Und jetzt ist es endlich so weit: Die Plattform heißt{" "}
            <span className="whitespace-nowrap font-semibold text-foreground">
              di<span className="text-primary">Ai</span>way
            </span>{" "}
            und ich bin zu <strong>95&nbsp;% startklar</strong>. Das Grundgerüst steht, der Kaffeevorrat ist beinahe leer
            und ich brenne darauf, bald offiziell live zu gehen – im Web und per App.
          </p>
        </div>

        <p className="mt-8 text-base font-medium text-stone-900 md:text-[17px]">
          Bevor ich den „Launch“-Button drücke, brauche ich aber <strong>deine Hilfe</strong>.
        </p>

        {/* Beta-Tester-Aufruf: Key-Visual direkt nach „brauche ich dich“ */}
        <div className="mx-auto mt-8 flex w-full justify-center">
          <div className="relative aspect-square w-full max-w-[min(88vw,26rem)] overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-border/60 sm:max-w-md md:max-w-lg">
            <Image
              src="/beta/hero-beta-de.png"
              alt="diAiway: Wir suchen Beta-Tester — DIY-Werkstatt mit Live-Experte auf dem Bildschirm und KI-Einblicken"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 88vw, 520px"
            />
          </div>
        </div>

        <p className="mt-8 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Hast du Lust,{" "}
          <strong>
            di<span className="text-primary">Ai</span>way
          </strong>{" "}
          als einer der Ersten auszuprobieren? Ich suche Neugierige und „Friendly User“, die die Plattform auf Herz und
          Nieren prüfen und mir Feedback geben, damit zum Start alles perfekt flutscht.
        </p>

        <p className="mt-6 text-base font-semibold text-stone-900 md:text-[17px]">Bist du dabei?</p>
        <p className="mt-2 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Schreib mir einfach kurz eine Nachricht oder melde dich hier an:
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            <a href={mailtoHref}>
              <Mail className="mr-2 size-4" aria-hidden />
              Nachricht schreiben
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-xl border-primary/30 bg-white text-base font-semibold text-primary hover:bg-primary/5"
          >
            <Link href="/">
              <UserPlus className="mr-2 size-4" aria-hidden />
              Jetzt registrieren
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Ich freue mich riesig auf dein Feedback und deine Unterstützung <strong>jeder Art</strong>!
        </p>
        <p className="mt-4 text-sm font-medium text-stone-600">Jens von diAIway</p>
      </article>

      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center text-xs text-stone-500 sm:flex-row sm:gap-6">
          <Link href="/legal/impressum" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Impressum
          </Link>
          <Link href="/legal/datenschutz" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Datenschutz
          </Link>
          <Link href="/" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Zur Startseite
          </Link>
        </div>
      </footer>
    </main>
  )
}

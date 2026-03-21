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
          Endspurt bei diAiway: Werde mein Beta-Tester! 🚀
        </h1>
        <p className="mt-6 text-lg font-medium leading-relaxed text-stone-800 md:text-xl">Hey!</p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Seit ein paar Jahren geistert mir schon diese Idee durch den Kopf: eine Plattform, auf der ich{" "}
          <strong>zielgerichtet Hilfe für meine DIY-Projekte</strong> bekomme. Zu viel Zeit und Mühe habe ich bei
          meinen Projekten mit endlosen Recherchen und unsinnigen Forenbeiträgen verschwendet.
        </p>

        <div className="mt-8 rounded-2xl border border-primary/15 bg-primary/[0.06] p-5 md:p-6">
          <p className="text-base font-semibold text-primary md:text-lg">Jetzt ist es endlich so weit</p>
          <p className="mt-3 text-base leading-relaxed text-stone-700 md:text-[17px]">
            Ich bin zu <strong>95&nbsp;% startklar</strong>. Das Grundgerüst von{" "}
            <span className="whitespace-nowrap font-semibold text-foreground">
              di<span className="text-primary">Ai</span>way
            </span>{" "}
            steht, der Kaffeevorrat ist leer und ich brenne darauf, bald offiziell live zu gehen.
          </p>
        </div>

        <p className="mt-8 text-base font-medium text-stone-900 md:text-[17px]">
          Aber bevor ich den „Launch“-Button drücke, brauche ich <strong>dich</strong>.
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
          als einer der Ersten auszuprobieren? Ich suche neugierige Beta-Tester und „friendly user“, die meine neue
          Plattform auf Herz und Nieren prüfen und mir Feedback geben, damit zum Start alles perfekt flutscht.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
        <p className="mt-4 text-sm text-stone-600">
          Schreib mir einfach kurz eine Nachricht — oder geh zur Startseite und registriere dich dort. Ich freue mich
          riesig auf deine Unterstützung <strong>jeder Art</strong>!
        </p>
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

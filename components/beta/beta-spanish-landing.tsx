import Image from "next/image"
import Link from "next/link"
import { Rocket, Mail, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BetaFounderCard } from "@/components/beta/beta-founder-card"
import { BetaLocaleSwitch } from "@/components/beta/beta-locale-switch"
import { getBetaMailto } from "@/lib/beta-mailto"

/** Beta en español — mismo layout que DE/EN; imagen hero en español. */
export function BetaSpanishLanding() {
  const mailtoHref = getBetaMailto()

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="relative bg-white pb-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] md:pb-8">
        <div className="absolute right-3 z-20 md:right-6 top-[max(0.5rem,env(safe-area-inset-top,0px))]">
          <BetaLocaleSwitch variant="light" />
        </div>
        <div className="mx-auto flex w-full justify-center px-3 pt-4 sm:px-4 md:pt-5">
          <BetaFounderCard
            label="Fundador"
            name="Jens de diAiway"
            imageAlt="Jens, fundador de diAiway"
          />
        </div>
      </section>

      <article className="mx-auto max-w-2xl px-4 pt-4 pb-8 md:pt-6 md:pb-12" lang="es">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[rgba(6,78,59,0.25)] bg-[rgba(6,78,59,0.1)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <Rocket className="size-3.5" aria-hidden />
          Ronda beta
        </p>
        <h1 className="mt-3 text-balance text-2xl font-bold leading-tight text-stone-900 md:text-4xl">
          Recta final en{" "}
          <span className="whitespace-nowrap">
            di<span className="text-primary">Ai</span>way
          </span>
          : necesito tu ayuda 🚀
        </h1>
        <p className="mt-6 text-lg font-medium leading-relaxed text-stone-800 md:text-xl">¡Hola!</p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Quien me conoce sabe que me encantan los proyectos DIY. Probar cosas nuevas, aprender, vivir experiencias
          nuevas — y al final sentir orgullo por lo que uno ha hecho con sus manos.
        </p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          <strong>PERO:</strong> ¿Cuánto tiempo y esfuerzo tiré en búsquedas interminables y mensajes de foro que no
          servían para nada? ¡De locos! Seguro que tú también lo has vivido.
        </p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Por eso llevo unos años dando vueltas a una idea: una plataforma donde consiga{" "}
          <strong>ayuda concreta para mis proyectos</strong>. Sin buscar durante horas, sin que te manden a paseo, sin
          estrés. Preguntar a alguien que de verdad sabe. Rápido, práctico, por teléfono o videollamada — ya sea para
          montar un mueble o restaurar un clásico.
        </p>

        <div className="mt-8 rounded-2xl border border-[rgba(6,78,59,0.15)] bg-[rgba(6,78,59,0.06)] p-5 md:p-6">
          <p className="text-base font-semibold leading-relaxed text-primary md:text-lg">
            Y por fin ha llegado el momento: la plataforma se llama{" "}
            <span className="whitespace-nowrap font-semibold text-foreground">
              di<span className="text-primary">Ai</span>way
            </span>{" "}
            y estoy a un <strong>95&nbsp;% listo para lanzar</strong>. La estructura está montada, el café casi se ha
            acabado y tengo muchísimas ganas de salir oficialmente — en la web y en la app.
          </p>
        </div>

        <p className="mt-8 text-base font-medium text-stone-900 md:text-[17px]">
          Antes de pulsar el botón de «lanzar», necesito <strong>tu ayuda</strong>.
        </p>

        <div className="mx-auto mt-8 flex w-full justify-center">
          <div className="relative aspect-square w-full max-w-[min(88vw,26rem)] overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[rgba(231,229,227,0.6)] sm:max-w-md md:max-w-lg">
            <Image
              src="/beta/hero-beta-es.png"
              alt="diAiway: buscamos beta testers — taller con proyecto DIY, experto en pantalla e información asistida por IA"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 88vw, 520px"
            />
          </div>
        </div>

        <p className="mt-8 text-base leading-relaxed text-stone-700 md:text-[17px]">
          ¿Te apetece probar{" "}
          <strong>
            di<span className="text-primary">Ai</span>way
          </strong>{" "}
          entre los primeros? Busco gente con curiosidad y «friendly users» que pongan a prueba la plataforma y me den
          feedback para que todo vaya sobre ruedas el día del lanzamiento.
        </p>

        <p className="mt-6 text-base font-semibold text-stone-900 md:text-[17px]">¿Te animas?</p>
        <p className="mt-2 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Escríbeme un mensaje corto o regístrate aquí:
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_8px_24px_rgba(6,78,59,0.22)] hover:bg-[rgba(6,78,59,0.9)]"
          >
            <a href={mailtoHref}>
              <Mail className="mr-2 size-4" aria-hidden />
              Enviar un mensaje
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-xl border-[rgba(6,78,59,0.3)] bg-white text-base font-semibold text-primary hover:bg-[rgba(6,78,59,0.05)]"
          >
            <Link href="/">
              <UserPlus className="mr-2 size-4" aria-hidden />
              Registrarse ahora
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Me haría muchísima ilusión recibir tu feedback y tu apoyo, <strong>de la forma que sea</strong>.
        </p>
        <p className="mt-4 text-sm font-medium text-stone-600">Jens de diAiway</p>
      </article>

      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center text-xs text-stone-500 sm:flex-row sm:gap-6">
          <Link href="/legal/impressum" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Aviso legal
          </Link>
          <Link href="/legal/datenschutz" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Privacidad
          </Link>
          <Link href="/" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Inicio
          </Link>
        </div>
      </footer>
    </main>
  )
}

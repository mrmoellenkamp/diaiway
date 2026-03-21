import Image from "next/image"
import Link from "next/link"
import { Rocket, Mail, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BetaLocaleSwitch } from "@/components/beta/beta-locale-switch"
import { getBetaMailto } from "@/lib/beta-mailto"

/** Beta en español — mismo layout que DE/EN; imagen hero en español. */
export function BetaSpanishLanding() {
  const mailtoHref = getBetaMailto()

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="relative bg-white pb-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))] md:pb-6">
        <div className="absolute right-3 z-20 md:right-6 top-[max(0.5rem,env(safe-area-inset-top,0px))]">
          <BetaLocaleSwitch variant="light" />
        </div>
        <div className="mx-auto flex w-full justify-center px-3 pt-4 sm:px-4 md:pt-5">
          <div className="relative aspect-square w-[min(78vw,420px)] overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-border/60 sm:w-[min(72vw,450px)] md:w-[min(45vh,480px)] lg:w-[min(51vh,540px)]">
            <Image
              src="/beta/hero-beta-es.png"
              alt="diAiway: buscamos beta testers — taller con proyecto DIY, experto en pantalla e información asistida por IA"
              fill
              priority
              className="object-contain object-center"
              sizes="(max-width: 768px) 85vw, 540px"
            />
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-2xl px-4 pt-4 pb-8 md:pt-6 md:pb-12" lang="es">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <Rocket className="size-3.5" aria-hidden />
          Ronda beta
        </p>
        <h1 className="mt-3 text-balance text-2xl font-bold leading-tight text-stone-900 md:text-4xl">
          La recta final de diAiway: ¡sé mi beta tester! 🚀
        </h1>
        <p className="mt-6 text-lg font-medium leading-relaxed text-stone-800 md:text-xl">¡Hola!</p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Llevo años con esta idea en la cabeza: una plataforma donde pueda obtener{" "}
          <strong>ayuda clara y directa para mis proyectos DIY</strong>. He tirado demasiado tiempo y energía en
          búsquedas interminables y hilos de foro que no llevaban a nada.
        </p>

        <div className="mt-8 rounded-2xl border border-primary/15 bg-primary/[0.06] p-5 md:p-6">
          <p className="text-base font-semibold text-primary md:text-lg">Por fin ha llegado el momento</p>
          <p className="mt-3 text-base leading-relaxed text-stone-700 md:text-[17px]">
            Estoy a un <strong>95&nbsp;% listo para lanzar</strong>. La base de{" "}
            <span className="whitespace-nowrap font-semibold text-foreground">
              di<span className="text-primary">Ai</span>way
            </span>{" "}
            está montada, el café se ha acabado y tengo muchísimas ganas de salir oficialmente.
          </p>
        </div>

        <p className="mt-8 text-base font-medium text-stone-900 md:text-[17px]">
          Pero antes de pulsar «lanzar», necesito <strong>a ti</strong>.
        </p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          ¿Te apetece probar{" "}
          <strong>
            di<span className="text-primary">Ai</span>way
          </strong>{" "}
          entre los primeros? Busco beta testers con curiosidad y personas que quieran usar la plataforma con buen
          rollo, probarla a fondo y contarme qué tal va, para que el arranque salga lo más redondo posible.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
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
            className="h-12 rounded-xl border-primary/30 bg-white text-base font-semibold text-primary hover:bg-primary/5"
          >
            <Link href="/">
              <UserPlus className="mr-2 size-4" aria-hidden />
              Registrarse ahora
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-stone-600">
          Escríbeme un mensaje corto — o entra en la página de inicio y regístrate allí. Te agradezco un montón tu
          apoyo, <strong>de la forma que sea</strong>.
        </p>

        <section className="mt-14 flex flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:gap-8 md:p-8">
          <div className="relative mx-auto size-36 shrink-0 overflow-hidden rounded-2xl shadow-md ring-2 ring-primary/10 md:mx-0 md:size-40">
            <Image
              src="/beta/jens-founder.png"
              alt="Jens, fundador de diAiway"
              fill
              className="object-cover object-[center_20%]"
              sizes="160px"
            />
          </div>
          <div className="min-w-0 text-center md:text-left">
            <p className="text-[10px] font-medium uppercase tracking-widest text-primary/70">Fundador</p>
            <p className="mt-1 text-lg font-bold text-stone-900">Jens de diAiway</p>
          </div>
        </section>
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

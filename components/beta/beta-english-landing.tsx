import Image from "next/image"
import Link from "next/link"
import { Rocket, Mail, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BetaFounderCard } from "@/components/beta/beta-founder-card"
import { BetaLocaleSwitch } from "@/components/beta/beta-locale-switch"
import { getBetaMailto } from "@/lib/beta-mailto"

/** English beta landing — same layout as DE; hero uses English key visual. */
export function BetaEnglishLanding() {
  const mailtoHref = getBetaMailto()

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="relative bg-white pb-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] md:pb-8">
        <div className="absolute right-3 z-20 md:right-6 top-[max(0.5rem,env(safe-area-inset-top,0px))]">
          <BetaLocaleSwitch variant="light" />
        </div>
        <div className="mx-auto flex w-full justify-center px-3 pt-4 sm:px-4 md:pt-5">
          <BetaFounderCard
            label="Founder"
            name="Jens from diAiway"
            imageAlt="Jens, founder of diAiway"
          />
        </div>
      </section>

      <article className="mx-auto max-w-2xl px-4 pt-4 pb-8 md:pt-6 md:pb-12" lang="en">
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <Rocket className="size-3.5" aria-hidden />
          Beta round
        </p>
        <h1 className="mt-3 text-balance text-2xl font-bold leading-tight text-stone-900 md:text-4xl">
          Final stretch at diAiway: be my beta tester! 🚀
        </h1>
        <p className="mt-6 text-lg font-medium leading-relaxed text-stone-800 md:text-xl">Hey!</p>
        <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-[17px]">
          For years I&apos;ve been carrying this idea around: a platform where I can get{" "}
          <strong>focused help for my DIY projects</strong>. Too often I&apos;ve burned time and energy on endless
          googling and useless forum threads.
        </p>

        <div className="mt-8 rounded-2xl border border-primary/15 bg-primary/[0.06] p-5 md:p-6">
          <p className="text-base font-semibold text-primary md:text-lg">Now it&apos;s finally happening</p>
          <p className="mt-3 text-base leading-relaxed text-stone-700 md:text-[17px]">
            I&apos;m about <strong>95&nbsp;% launch-ready</strong>. The core of{" "}
            <span className="whitespace-nowrap font-semibold text-foreground">
              di<span className="text-primary">Ai</span>way
            </span>{" "}
            is in place, the coffee has run out, and I&apos;m itching to go officially live.
          </p>
        </div>

        <p className="mt-8 text-base font-medium text-stone-900 md:text-[17px]">
          But before I hit the launch button, I need <strong>you</strong>.
        </p>

        <div className="mx-auto mt-8 flex w-full justify-center">
          <div className="relative aspect-square w-full max-w-[min(88vw,26rem)] overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-border/60 sm:max-w-md md:max-w-lg">
            <Image
              src="/beta/hero-beta-en.png"
              alt="diAiway: we are seeking beta testers — workshop with DIY builders, live expert on screen, and AI-powered insights"
              fill
              className="object-contain object-center"
              sizes="(max-width: 768px) 88vw, 520px"
            />
          </div>
        </div>

        <p className="mt-8 text-base leading-relaxed text-stone-700 md:text-[17px]">
          Fancy trying{" "}
          <strong>
            di<span className="text-primary">Ai</span>way
          </strong>{" "}
          among the first? I&apos;m looking for curious beta testers and friendly early users to put the platform
          through its paces and share feedback — so everything feels smooth on day one.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            <a href={mailtoHref}>
              <Mail className="mr-2 size-4" aria-hidden />
              Send a message
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
              Sign up now
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-stone-600">
          Drop me a quick note — or head to the homepage and sign up there. I&apos;m grateful for your support in{" "}
          <strong>any shape or form</strong>!
        </p>
      </article>

      <footer className="border-t border-stone-200 bg-white py-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center text-xs text-stone-500 sm:flex-row sm:gap-6">
          <Link href="/legal/impressum" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Legal notice
          </Link>
          <Link href="/legal/datenschutz" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Privacy
          </Link>
          <Link href="/" className="underline-offset-2 hover:text-stone-800 hover:underline">
            Homepage
          </Link>
        </div>
      </footer>
    </main>
  )
}

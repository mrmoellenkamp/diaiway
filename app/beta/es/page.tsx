import type { Metadata } from "next"
import { BetaSpanishLanding } from "@/components/beta/beta-spanish-landing"

export const metadata: Metadata = {
  title: "Beta | diAiway",
  description:
    "Prueba diAiway entre los primeros: ayuda enfocada para tus proyectos DIY. Únete a la beta y cuéntanos qué tal.",
  robots: { index: false, follow: false },
}

export default function BetaEsPage() {
  return <BetaSpanishLanding />
}

import type { Metadata } from "next"
import { BetaSpanishLanding } from "@/components/beta/beta-spanish-landing"

export const metadata: Metadata = {
  title: "Recta final en diAiway: necesito tu ayuda",
  description:
    "DIY sin buscar eternamente: diAiway casi listo para lanzar. Sé friendly user, prueba la plataforma y danos feedback antes del arranque.",
  robots: { index: false, follow: false },
}

export default function BetaEsPage() {
  return <BetaSpanishLanding />
}

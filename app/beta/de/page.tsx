import type { Metadata } from "next"
import { BetaGermanLanding } from "@/components/beta/beta-german-landing"

export const metadata: Metadata = {
  title: "Endspurt bei diAiway: Ich brauche deine Hilfe",
  description:
    "DIY ohne endloses Suchen: diAiway ist fast startklar. Werde Friendly User, teste die Plattform und gib Feedback — vor dem Launch.",
  robots: { index: false, follow: false },
}

export default function BetaDePage() {
  return <BetaGermanLanding />
}

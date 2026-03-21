import type { Metadata } from "next"
import { BetaGermanLanding } from "@/components/beta/beta-german-landing"

export const metadata: Metadata = {
  title: "Beta-Test | diAiway",
  description:
    "Werde Beta-Tester:in bei diAiway — zielgerichtete Hilfe für DIY-Projekte. Jetzt Feedback geben und die Plattform mitgestalten.",
  robots: { index: false, follow: false },
}

export default function BetaDePage() {
  return <BetaGermanLanding />
}

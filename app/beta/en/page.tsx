import type { Metadata } from "next"
import { BetaEnglishLanding } from "@/components/beta/beta-english-landing"

export const metadata: Metadata = {
  title: "Beta test | diAiway",
  description:
    "Be among the first to try diAiway — focused help for DIY projects. Join our beta and share feedback before launch.",
  robots: { index: false, follow: false },
}

export default function BetaEnPage() {
  return <BetaEnglishLanding />
}

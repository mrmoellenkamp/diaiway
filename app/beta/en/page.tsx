import type { Metadata } from "next"
import { BetaEnglishLanding } from "@/components/beta/beta-english-landing"

export const metadata: Metadata = {
  title: "Final stretch at diAiway: I need your help",
  description:
    "DIY without endless searching: diAiway is almost launch-ready. Be a friendly early user, try the platform, and share feedback before go-live.",
  robots: { index: false, follow: false },
}

export default function BetaEnPage() {
  return <BetaEnglishLanding />
}

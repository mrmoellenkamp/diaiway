import type { Metadata } from "next"
import { getRequestLocale } from "@/lib/server-locale"
import { serverT } from "@/lib/i18n/server-t"
import { HowItWorksClient } from "./how-it-works-client"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title: serverT(locale, "howItWorks.metaTitle"),
    description: serverT(locale, "howItWorks.metaDescription"),
  }
}

export default function HowItWorksPage() {
  return <HowItWorksClient />
}

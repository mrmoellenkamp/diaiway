/**
 * Server-seitige Takumi-Abfrage für ISR/Static Generation.
 * Gleiche Logik wie GET /api/takumis, ohne HTTP-Overhead.
 */
import { prisma } from "@/lib/db"
import type { Takumi } from "@/lib/types"
import { ensureTaxonomySeeded } from "@/lib/taxonomy-server"
import { expertRowToTakumi, expertTaxonomyInclude } from "@/lib/expert-to-takumi"

export async function getTakumisForServer(): Promise<Takumi[]> {
  await ensureTaxonomySeeded()

  const experts = await prisma.expert.findMany({
    include: expertTaxonomyInclude,
    orderBy: { rating: "desc" },
  })

  const active = experts.filter((e) => {
    if (!e.userId) return true
    const u = e.user
    return u && u.appRole === "takumi"
  })

  return active.map((e) => expertRowToTakumi(e))
}

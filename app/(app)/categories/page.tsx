import { getTakumisForServer } from "@/lib/takumis-server"
import { CategoriesPageClient } from "@/components/categories-page-client"

/** Dynamisch: Kein DB-Zugriff beim Build – Build läuft auch ohne erreichbare DB (z.B. CI). */
export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const takumis = await getTakumisForServer()
  return <CategoriesPageClient takumis={takumis} />
}

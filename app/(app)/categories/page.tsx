import { getTakumisForServer } from "@/lib/takumis-server"
import { CategoriesPageClient } from "@/components/categories-page-client"

/** ISR: 1 Stunde Cache – Experten-Liste statisch serviert, On-Demand-Revalidation bei Profil-Updates */
export const revalidate = 3600

export default async function CategoriesPage() {
  const takumis = await getTakumisForServer()
  return <CategoriesPageClient takumis={takumis} />
}

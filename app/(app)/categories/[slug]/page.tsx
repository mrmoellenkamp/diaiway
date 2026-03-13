import { notFound } from "next/navigation"
import { categories } from "@/lib/categories"
import { getTakumisForServer } from "@/lib/takumis-server"
import { CategoryDetailPageClient } from "@/components/category-detail-page-client"

/** ISR: 1 Stunde Cache – Kategorie-Detail statisch serviert */
export const revalidate = 3600

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [takumis, category] = await Promise.all([
    getTakumisForServer(),
    Promise.resolve(categories.find((c) => c.slug === slug)),
  ])

  if (!category) notFound()

  const categoryTakumis = takumis.filter((tk) => tk.categorySlug === slug)

  return (
    <CategoryDetailPageClient
      slug={slug}
      category={category}
      categoryTakumis={categoryTakumis}
    />
  )
}

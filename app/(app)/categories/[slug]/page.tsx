import { Suspense } from "react"
import { notFound } from "next/navigation"
import { categories } from "@/lib/categories"
import { getTakumisForServer } from "@/lib/takumis-server"
import { CategoryDetailPageClient } from "@/components/category-detail-page-client"
import { CategoryDetailSkeleton } from "@/components/category-detail-skeleton"

/** ISR: 1 Stunde Cache – Kategorie-Detail statisch serviert */
export const revalidate = 3600

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()

  return (
    <Suspense fallback={<CategoryDetailSkeleton slug={slug} category={category} />}>
      <CategoryDetailContent slug={slug} category={category} />
    </Suspense>
  )
}

async function CategoryDetailContent({ slug, category }: { slug: string; category: (typeof categories)[number] }) {
  const takumis = await getTakumisForServer()
  const categoryTakumis = takumis.filter((tk) => tk.categorySlug === slug)

  return (
    <CategoryDetailPageClient
      slug={slug}
      category={category}
      categoryTakumis={categoryTakumis}
    />
  )
}

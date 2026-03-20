import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTakumisForServer } from "@/lib/takumis-server"
import { getCategoryForAppBySlug } from "@/lib/taxonomy-server"
import { CategoryDetailPageClient } from "@/components/category-detail-page-client"
import { CategoryDetailSkeleton } from "@/components/category-detail-skeleton"
import type { Category } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = await getCategoryForAppBySlug(slug)
  if (!category) notFound()

  return (
    <Suspense fallback={<CategoryDetailSkeleton slug={slug} category={category} />}>
      <CategoryDetailContent slug={slug} category={category} />
    </Suspense>
  )
}

async function CategoryDetailContent({ slug, category }: { slug: string; category: Category }) {
  const takumis = await getTakumisForServer()
  const categoryTakumis = takumis.filter((tk) => (tk.categorySlugs ?? [tk.categorySlug]).includes(slug))

  return (
    <CategoryDetailPageClient
      slug={slug}
      category={category}
      categoryTakumis={categoryTakumis}
    />
  )
}

import { Suspense } from "react"
import { notFound } from "next/navigation"
import { categories } from "@/lib/categories"
import { getTakumisForServer } from "@/lib/takumis-server"
import { CategoryDetailPageClient } from "@/components/category-detail-page-client"
import { CategoryDetailSkeleton } from "@/components/category-detail-skeleton"

/** Dynamisch: Kein DB-Zugriff beim Build – Build läuft auch ohne erreichbare DB (z.B. CI). */
export const dynamic = "force-dynamic"

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

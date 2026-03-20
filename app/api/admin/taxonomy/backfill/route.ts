import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/require-admin"
import { backfillExpertTaxonomyFromLegacy, isTaxonomySchemaAvailable } from "@/lib/taxonomy-server"
import { revalidatePath } from "next/cache"

export const runtime = "nodejs"

export async function POST() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  if (!(await isTaxonomySchemaAvailable())) {
    return NextResponse.json(
      {
        error:
          "Taxonomie-Tabellen fehlen. Zuerst npx prisma migrate deploy (20260320120000_taxonomy_categories).",
        code: "TAXONOMY_SCHEMA_MISSING",
      },
      { status: 503 },
    )
  }
  try {
    const { updated } = await backfillExpertTaxonomyFromLegacy()
    revalidatePath("/categories")
    revalidatePath("/takumis")
    return NextResponse.json({ success: true, updated })
  } catch (err: unknown) {
    console.error("[taxonomy backfill]", err)
    return NextResponse.json({ error: "Backfill fehlgeschlagen." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"
import { isTaxonomySchemaAvailable } from "@/lib/taxonomy-server"

export const runtime = "nodejs"

/**
 * POST body: { ids: string[] } — vollständige Reihenfolge aller Kategorie-IDs (sortOrder = Index).
 */
export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  if (!(await isTaxonomySchemaAvailable())) {
    return NextResponse.json(
      { error: "Taxonomie-Schema fehlt. npx prisma migrate deploy ausführen.", code: "TAXONOMY_SCHEMA_MISSING" },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const ids = (body as { ids?: unknown })?.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && id.length > 0)) {
    return NextResponse.json({ error: "ids: nicht-leeres String-Array erforderlich." }, { status: 400 })
  }

  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    return NextResponse.json({ error: "Doppelte IDs nicht erlaubt." }, { status: 400 })
  }

  try {
    const existing = await prisma.taxonomyCategory.findMany({ select: { id: true } })
    const dbIds = new Set(existing.map((r) => r.id))
    if (ids.length !== dbIds.size || !ids.every((id) => dbIds.has(id))) {
      return NextResponse.json(
        { error: "ids muss exakt alle Kategorie-IDs in der gewünschten Reihenfolge enthalten." },
        { status: 400 },
      )
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.taxonomyCategory.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[admin taxonomy categories reorder]", err)
    return NextResponse.json({ error: "Sortierung speichern fehlgeschlagen." }, { status: 500 })
  }
}

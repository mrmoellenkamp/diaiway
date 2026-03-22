import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"
import { isTaxonomySchemaAvailable } from "@/lib/taxonomy-server"

export const runtime = "nodejs"

/**
 * POST body: { categoryId: string, ids: string[] } — Reihenfolge der Fachbereiche dieser Kategorie.
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

  const categoryId = (body as { categoryId?: unknown })?.categoryId
  const ids = (body as { ids?: unknown })?.ids

  if (typeof categoryId !== "string" || !categoryId) {
    return NextResponse.json({ error: "categoryId erforderlich." }, { status: 400 })
  }
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && id.length > 0)) {
    return NextResponse.json({ error: "ids: nicht-leeres String-Array erforderlich." }, { status: 400 })
  }

  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    return NextResponse.json({ error: "Doppelte IDs nicht erlaubt." }, { status: 400 })
  }

  try {
    const specs = await prisma.taxonomySpecialty.findMany({
      where: { categoryId },
      select: { id: true },
    })
    const dbIds = new Set(specs.map((s) => s.id))
    if (ids.length !== dbIds.size || !ids.every((id) => dbIds.has(id))) {
      return NextResponse.json(
        { error: "ids muss exakt alle Fachbereichs-IDs dieser Kategorie enthalten." },
        { status: 400 },
      )
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.taxonomySpecialty.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[admin taxonomy specialties reorder]", err)
    return NextResponse.json({ error: "Sortierung speichern fehlgeschlagen." }, { status: 500 })
  }
}

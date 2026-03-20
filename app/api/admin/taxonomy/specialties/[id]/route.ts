import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"
import { isTaxonomySchemaAvailable } from "@/lib/taxonomy-server"

export const runtime = "nodejs"

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  if (!(await isTaxonomySchemaAvailable())) {
    return NextResponse.json(
      { error: "Taxonomie-Schema fehlt. npx prisma migrate deploy ausführen.", code: "TAXONOMY_SCHEMA_MISSING" },
      { status: 503 },
    )
  }
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (typeof body.name === "string") data.name = body.name.trim()
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder
    if (typeof body.isActive === "boolean") data.isActive = body.isActive

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 })
    }

    const spec = await prisma.taxonomySpecialty.update({
      where: { id },
      data,
    })
    return NextResponse.json({ specialty: spec })
  } catch (err: unknown) {
    console.error("[admin taxonomy specialty PATCH]", err)
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  if (!(await isTaxonomySchemaAvailable())) {
    return NextResponse.json(
      { error: "Taxonomie-Schema fehlt. npx prisma migrate deploy ausführen.", code: "TAXONOMY_SCHEMA_MISSING" },
      { status: 503 },
    )
  }
  const { id } = await ctx.params
  try {
    const n = await prisma.specialtyOnExpert.count({ where: { specialtyId: id } })
    if (n > 0) {
      await prisma.taxonomySpecialty.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({ success: true, soft: true })
    }
    await prisma.taxonomySpecialty.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[admin taxonomy specialty DELETE]", err)
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 })
  }
}

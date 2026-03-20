import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"
import { generateUniqueCategorySlug } from "@/lib/taxonomy-server"
import { isValidTaxonomyIconKey } from "@/lib/taxonomy-icons"

export const runtime = "nodejs"

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (typeof body.name === "string") data.name = body.name.trim()
    if (typeof body.description === "string") data.description = body.description.trim()
    if (typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)) data.color = body.color
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder
    if (typeof body.isActive === "boolean") data.isActive = body.isActive
    if (typeof body.iconKey === "string" && isValidTaxonomyIconKey(body.iconKey)) data.iconKey = body.iconKey
    if (body.iconImageUrl === null) data.iconImageUrl = null
    else if (typeof body.iconImageUrl === "string" && body.iconImageUrl.startsWith("http")) {
      data.iconImageUrl = body.iconImageUrl
    }

    if (typeof body.slug === "string" && body.slug.trim()) {
      let newSlug = body.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
      const other = await prisma.taxonomyCategory.findFirst({
        where: { slug: newSlug, NOT: { id } },
      })
      if (other) {
        newSlug = await generateUniqueCategorySlug(newSlug)
      }
      data.slug = newSlug
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 })
    }

    const cat = await prisma.taxonomyCategory.update({
      where: { id },
      data,
    })
    return NextResponse.json({ category: cat })
  } catch (err: unknown) {
    console.error("[admin taxonomy category PATCH]", err)
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  const { id } = await ctx.params
  try {
    const n = await prisma.categoryOnExpert.count({ where: { categoryId: id } })
    if (n > 0) {
      await prisma.taxonomyCategory.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({ success: true, soft: true, message: "Kategorie deaktiviert (noch Takumis zugeordnet)." })
    }
    await prisma.taxonomyCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[admin taxonomy category DELETE]", err)
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 })
  }
}

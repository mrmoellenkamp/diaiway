import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"
import { generateUniqueCategorySlug, getAllTaxonomyCategoriesAdmin } from "@/lib/taxonomy-server"
import { isValidTaxonomyIconKey } from "@/lib/taxonomy-icons"

export const runtime = "nodejs"

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  try {
    const rows = await getAllTaxonomyCategoriesAdmin()
    return NextResponse.json({
      categories: rows.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        iconKey: c.iconKey,
        iconImageUrl: c.iconImageUrl,
        color: c.color,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        expertCount: c._count.categoryOnExperts,
        specialties: c.specialties.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
        })),
      })),
    })
  } catch (err: unknown) {
    console.error("[admin taxonomy categories GET]", err)
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  try {
    const body = await req.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) {
      return NextResponse.json({ error: "Name erforderlich." }, { status: 400 })
    }
    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
        : await generateUniqueCategorySlug(name)
    const existing = await prisma.taxonomyCategory.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: "Slug bereits vergeben." }, { status: 409 })
    }
    const iconKey =
      typeof body.iconKey === "string" && isValidTaxonomyIconKey(body.iconKey) ? body.iconKey : "Briefcase"
    const color = typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : "#64748b"
    const description = typeof body.description === "string" ? body.description.trim() : ""
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 999
    const iconImageUrl =
      typeof body.iconImageUrl === "string" && body.iconImageUrl.startsWith("http") ? body.iconImageUrl : null

    const cat = await prisma.taxonomyCategory.create({
      data: {
        slug,
        name,
        description,
        iconKey,
        color,
        sortOrder,
        iconImageUrl,
        isActive: body.isActive !== false,
      },
    })
    return NextResponse.json({ category: cat }, { status: 201 })
  } catch (err: unknown) {
    console.error("[admin taxonomy categories POST]", err)
    return NextResponse.json({ error: "Anlegen fehlgeschlagen." }, { status: 500 })
  }
}

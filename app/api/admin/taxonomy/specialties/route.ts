import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  try {
    const body = await req.json()
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : ""
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!categoryId || !name) {
      return NextResponse.json({ error: "categoryId und name erforderlich." }, { status: 400 })
    }
    const cat = await prisma.taxonomyCategory.findUnique({ where: { id: categoryId } })
    if (!cat) return NextResponse.json({ error: "Kategorie nicht gefunden." }, { status: 404 })

    const maxSort = await prisma.taxonomySpecialty.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    })
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : (maxSort._max.sortOrder ?? 0) + 1

    const spec = await prisma.taxonomySpecialty.create({
      data: {
        categoryId,
        name,
        sortOrder,
        isActive: body.isActive !== false,
      },
    })
    return NextResponse.json({ specialty: spec }, { status: 201 })
  } catch (err: unknown) {
    console.error("[admin taxonomy specialties POST]", err)
    return NextResponse.json({ error: "Anlegen fehlgeschlagen." }, { status: 500 })
  }
}

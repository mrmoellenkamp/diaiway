import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminApi } from "@/lib/require-admin"

export const runtime = "nodejs"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const data: { title?: string; body?: string; isActive?: boolean; sortOrder?: number } = {}
  if (body.title !== undefined) data.title = String(body.title).trim()
  if (body.body !== undefined) data.body = String(body.body).trim()
  if (body.isActive !== undefined) data.isActive = !!body.isActive
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 })
  }

  const updated = await prisma.takumiProfileRevokeSnippet.update({
    where: { id },
    data,
  })
  return NextResponse.json({ snippet: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response
  const { id } = await params
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 })

  await prisma.takumiProfileRevokeSnippet.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

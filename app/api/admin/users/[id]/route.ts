import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { role, appRole, name } = body

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(role ? { role } : {}),
      ...(appRole ? { appRole } : {}),
      ...(name ? { name } : {}),
    },
    select: { id: true, name: true, email: true, role: true, appRole: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Prevent self-deletion
  if (id === (session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Kann den eigenen Account nicht löschen" }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

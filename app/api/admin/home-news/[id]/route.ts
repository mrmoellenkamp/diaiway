import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/** Kein `ReturnType<typeof auth>` — in manchen Next/NextAuth-Kombinationen fälschlich `NextMiddleware`. */
function assertAdmin(session: { user?: unknown } | null) {
  const u = session?.user as { id?: string; role?: string } | undefined
  if (!u?.id || u.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 })
  }
  return null
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const err = assertAdmin(session)
  if (err) return err
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const data: {
      title?: string
      body?: string
      linkUrl?: string | null
      linkLabel?: string | null
      published?: boolean
      sortOrder?: number
      publishedAt?: Date | null
    } = {}

    if (typeof body.title === "string") data.title = body.title.trim()
    if (typeof body.body === "string") data.body = body.body.trim()
    if (body.linkUrl === null) data.linkUrl = null
    else if (typeof body.linkUrl === "string") data.linkUrl = body.linkUrl.trim() || null
    if (body.linkLabel === null) data.linkLabel = null
    else if (typeof body.linkLabel === "string") data.linkLabel = body.linkLabel.trim() || null
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder
    if (typeof body.published === "boolean") {
      data.published = body.published
      if (body.published) {
        const existing = await prisma.homeNewsItem.findUnique({ where: { id }, select: { publishedAt: true } })
        if (!existing?.publishedAt) data.publishedAt = new Date()
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Keine Felder zum Aktualisieren." }, { status: 400 })
    }

    const item = await prisma.homeNewsItem.update({
      where: { id },
      data,
    })
    revalidatePath("/home")
    revalidatePath("/")
    return NextResponse.json({
      item: {
        ...item,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    })
  } catch {
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const err = assertAdmin(session)
  if (err) return err
  const { id } = await ctx.params
  try {
    await prisma.homeNewsItem.delete({ where: { id } })
    revalidatePath("/home")
    revalidatePath("/")
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function assertAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user?.id || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 })
  }
  return null
}

/** Admin: alle Einträge inkl. Entwürfe */
export async function GET() {
  const session = await auth()
  const err = assertAdmin(session)
  if (err) return err
  try {
    const items = await prisma.homeNewsItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 100,
    })
    return NextResponse.json({
      items: items.map((i) => ({
        ...i,
        publishedAt: i.publishedAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  const err = assertAdmin(session)
  if (err) return err
  try {
    const body = await req.json()
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const rawBody = typeof body.body === "string" ? body.body.trim() : ""
    if (!title || !rawBody) {
      return NextResponse.json({ error: "Titel und Text erforderlich." }, { status: 400 })
    }
    const published = !!body.published
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0
    const linkUrl = typeof body.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : null
    const linkLabel = typeof body.linkLabel === "string" && body.linkLabel.trim() ? body.linkLabel.trim() : null

    const item = await prisma.homeNewsItem.create({
      data: {
        title,
        body: rawBody,
        linkUrl,
        linkLabel,
        published,
        sortOrder,
        publishedAt: published ? new Date() : null,
      },
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
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

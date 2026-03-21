import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { parseTranslationsFromBody } from "@/lib/home-news-locales"
import { serializeAdminHomeNewsItem } from "@/lib/home-news-admin-serialize"

export const runtime = "nodejs"

function assertAdmin(session: { user?: unknown } | null) {
  const u = session?.user as { id?: string; role?: string } | undefined
  if (!u?.id || u.role !== "admin") {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 })
  }
  return null
}

/** Admin: alle Einträge inkl. Entwürfe + alle Sprachfassungen */
export async function GET() {
  const session = await auth()
  const err = assertAdmin(session)
  if (err) return err
  try {
    const items = await prisma.homeNewsItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 100,
      include: { translations: { orderBy: { locale: "asc" } } },
    })
    return NextResponse.json({
      items: items.map(serializeAdminHomeNewsItem),
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
    const translations = parseTranslationsFromBody(body.translations)
    if (!translations) {
      return NextResponse.json(
        { error: "Mindestens eine Sprachfassung mit Titel und Text (translations.de/en/es)." },
        { status: 400 },
      )
    }
    const published = !!body.published
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0
    const linkUrl = typeof body.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : null
    const linkLabel = typeof body.linkLabel === "string" && body.linkLabel.trim() ? body.linkLabel.trim() : null

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.homeNewsItem.create({
        data: {
          linkUrl,
          linkLabel,
          published,
          sortOrder,
          publishedAt: published ? new Date() : null,
        },
      })
      await tx.homeNewsTranslation.createMany({
        data: Object.entries(translations).map(([locale, tr]) => ({
          newsItemId: created.id,
          locale,
          title: tr.title,
          body: tr.body,
          linkUrl: tr.linkUrl ?? null,
          linkLabel: tr.linkLabel ?? null,
        })),
      })
      return tx.homeNewsItem.findUniqueOrThrow({
        where: { id: created.id },
        include: { translations: true },
      })
    })

    revalidatePath("/home")
    revalidatePath("/")
    return NextResponse.json({ item: serializeAdminHomeNewsItem(item) })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

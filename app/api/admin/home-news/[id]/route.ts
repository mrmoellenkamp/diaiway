import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { HOME_NEWS_LOCALES } from "@/lib/home-news-locales"
import { serializeAdminHomeNewsItem } from "@/lib/home-news-admin-serialize"

export const runtime = "nodejs"

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
    const itemData: {
      linkUrl?: string | null
      linkLabel?: string | null
      published?: boolean
      sortOrder?: number
      publishedAt?: Date | null
    } = {}

    if (body.linkUrl === null) itemData.linkUrl = null
    else if (typeof body.linkUrl === "string") itemData.linkUrl = body.linkUrl.trim() || null
    if (body.linkLabel === null) itemData.linkLabel = null
    else if (typeof body.linkLabel === "string") itemData.linkLabel = body.linkLabel.trim() || null
    if (typeof body.sortOrder === "number") itemData.sortOrder = body.sortOrder
    if (typeof body.published === "boolean") {
      itemData.published = body.published
      if (body.published) {
        const existing = await prisma.homeNewsItem.findUnique({ where: { id }, select: { publishedAt: true } })
        if (!existing?.publishedAt) itemData.publishedAt = new Date()
      }
    }

    const rawTranslations =
      body.translations && typeof body.translations === "object"
        ? (body.translations as Record<string, unknown>)
        : null

    let touchedTranslations = false
    if (rawTranslations) {
      for (const loc of HOME_NEWS_LOCALES) {
        const block = rawTranslations[loc]
        if (block === undefined) continue
        if (typeof block !== "object" || block === null) continue
        touchedTranslations = true
        const title = typeof (block as { title?: unknown }).title === "string" ? (block as { title: string }).title.trim() : ""
        const bodyText =
          typeof (block as { body?: unknown }).body === "string" ? (block as { body: string }).body.trim() : ""

        if (title && bodyText) {
          await prisma.homeNewsTranslation.upsert({
            where: { newsItemId_locale: { newsItemId: id, locale: loc } },
            create: { newsItemId: id, locale: loc, title, body: bodyText },
            update: { title, body: bodyText },
          })
        } else if (title === "" && bodyText === "") {
          await prisma.homeNewsTranslation.deleteMany({ where: { newsItemId: id, locale: loc } })
        }
      }
    }

    if (Object.keys(itemData).length === 0 && !touchedTranslations) {
      return NextResponse.json({ error: "Keine Felder zum Aktualisieren." }, { status: 400 })
    }

    if (Object.keys(itemData).length > 0) {
      await prisma.homeNewsItem.update({ where: { id }, data: itemData })
    }

    const item = await prisma.homeNewsItem.findUniqueOrThrow({
      where: { id },
      include: { translations: true },
    })

    revalidatePath("/home")
    revalidatePath("/")
    return NextResponse.json({ item: serializeAdminHomeNewsItem(item) })
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

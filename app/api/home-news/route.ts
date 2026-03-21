import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeHomeNewsLocale, pickNewsTranslationForLocale } from "@/lib/home-news-locales"

export const runtime = "nodejs"

/** Öffentlich: veröffentlichte News, Text je nach ?locale=de|en|es (Fallback: de → erste vorhandene). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const locale = normalizeHomeNewsLocale(searchParams.get("locale"))

    const rows = await prisma.homeNewsItem.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      take: 20,
      include: { translations: true },
    })

    const items = rows
      .map((row) => {
        const tr = pickNewsTranslationForLocale(row.translations, locale)
        if (!tr) return null
        return {
          id: row.id,
          title: tr.title,
          body: tr.body,
          linkUrl: row.linkUrl,
          linkLabel: row.linkLabel,
          publishedAt: row.publishedAt?.toISOString() ?? null,
          localeUsed: tr.locale,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return NextResponse.json({ items, requestedLocale: locale })
  } catch {
    return NextResponse.json({ items: [], requestedLocale: "de" })
  }
}
